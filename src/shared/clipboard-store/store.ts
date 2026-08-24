import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { AddInput, ClipItem, ClipType, PersistShape } from './types'
import { classifyText } from './classify'

/**
 * 영속 데이터 암호화 포트 (느슨 결합 — electron 무관, D29).
 * main 프로세스가 safeStorage(DPAPI) 기반 구현을 주입한다. 미주입 시 평문(IDENTITY_CIPHER).
 * - encrypt: 평문 JSON 문자열 → 파일에 쓸 문자열(암호문 래퍼)
 * - decrypt: 파일에서 읽은 문자열 → 평문 JSON 문자열. 구 평문 파일은 그대로 통과(마이그레이션)
 */
export interface Cipher {
  encrypt(plain: string): string
  decrypt(stored: string): string
}

/** 기본 cipher — 평문 그대로(현재 동작 보존, 테스트는 electron 없이 통과). */
export const IDENTITY_CIPHER: Cipher = {
  encrypt: (plain) => plain,
  decrypt: (stored) => stored
}

export interface ClipboardStoreOptions {
  /** JSON 영속화 파일 경로 */
  filePath: string
  /** 비핀 항목 최대 보유 수 (기본 100, D7) */
  maxSize?: number
  /** 영속 암호화 포트(D29). 미지정 시 평문(IDENTITY_CIPHER). */
  cipher?: Cipher
}

const DEFAULT_MAX = 100

/**
 * 클립보드 히스토리 스토어 (느슨 결합 — electron 무관).
 * - ring buffer: 비핀 항목이 maxSize 초과하면 가장 오래된 비핀부터 축출
 * - 핀 항목은 카운트에서 제외되고 절대 축출되지 않음 (D7)
 * - 로컬 JSON 영속화 (save/load)
 *
 * items 는 [가장 오래된 ... 가장 최신] 순서로 보관(push 가 최신).
 */
export class ClipboardStore {
  private items: ClipItem[] = []
  private seq = 0
  private maxSize: number
  private readonly filePath: string
  private readonly cipher: Cipher
  /** 같은 파일에 대한 저장을 호출 순서대로 직렬화한다. */
  private saveQueue: Promise<void> = Promise.resolve()

  constructor(opts: ClipboardStoreOptions) {
    this.filePath = opts.filePath
    this.maxSize = opts.maxSize ?? DEFAULT_MAX
    this.cipher = opts.cipher ?? IDENTITY_CIPHER
  }

  /** 최신이 마지막인 불변 뷰. */
  getAll(): readonly ClipItem[] {
    return this.items
  }

  /** 가장 최근 항목(없으면 undefined). */
  latest(): ClipItem | undefined {
    return this.items[this.items.length - 1]
  }

  /** 비핀 항목 수 (ring buffer 카운트 기준). */
  get unpinnedCount(): number {
    return this.items.reduce((n, it) => (it.pinned ? n : n + 1), 0)
  }

  /** 총 보유 항목 수(핀 포함). */
  get size(): number {
    return this.items.length
  }

  add(input: AddInput): ClipItem {
    const createdAt = input.createdAt ?? Date.now()
    const item: ClipItem = {
      id: `${createdAt}-${this.seq++}`,
      type: input.type ?? classifyText(input.content),
      content: input.content,
      pinned: input.pinned ?? false,
      createdAt
    }
    this.items.push(item)
    this.evict()
    return item
  }

  /**
   * 이미 있는 항목을 최신 위치(배열 끝 = 화면 맨 앞)로 옮긴다 — 재복사 승격(D34).
   * 새 카드를 만들지 않으므로 보유 개수·id·pinned 가 그대로 유지되고, createdAt 만
   * 갱신해 카드의 경과 시간 표시가 실제 마지막 사용 시각을 따른다.
   * @returns 승격된 항목. 해당 id 가 없으면 undefined.
   */
  promote(id: string, at?: number): ClipItem | undefined {
    const index = this.items.findIndex((i) => i.id === id)
    if (index < 0) return undefined
    const [item] = this.items.splice(index, 1)
    if (!item) return undefined
    item.createdAt = at ?? Date.now()
    this.items.push(item)
    return item
  }

  /**
   * 같은 타입·내용의 항목 중 가장 최신 것을 찾는다 — 적재 전 중복 판정(D34)에 쓴다.
   * 핀 여부는 가리지 않는다(핀도 승격 대상).
   */
  findLatestByContent(type: ClipType, content: string): ClipItem | undefined {
    for (let index = this.items.length - 1; index >= 0; index--) {
      const item = this.items[index]
      if (item && item.type === type && item.content === content) return item
    }
    return undefined
  }

  /** 핀 토글. 핀 해제 시 즉시 ring buffer 규칙 재적용. */
  setPinned(id: string, pinned: boolean): void {
    const it = this.items.find((i) => i.id === id)
    if (!it) return
    it.pinned = pinned
    if (!pinned) this.evict()
  }

  /** id 항목 삭제. */
  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id)
  }

  /** 전체 비우기(핀 포함) — 메모리 리셋용(D17). */
  clear(): void {
    this.items = []
  }

  /** 핀을 제외한 모든 항목 삭제 — "모두 지우기"(D15). 핀은 보존. */
  clearUnpinned(): void {
    this.items = this.items.filter((i) => i.pinned)
  }

  /**
   * 비핀 중 같은 타입·내용의 중복을 최신 항목 하나만 남기고 제거한다.
   * 핀 항목은 영구 보존 규칙(D7)에 따라 건드리지 않으며, 같은 내용의 비핀도 제거한다.
   */
  removeDuplicates(): number {
    const seenByType = new Map<ClipItem['type'], Set<string>>()
    const seenContents = (type: ClipItem['type']): Set<string> => {
      let contents = seenByType.get(type)
      if (!contents) {
        contents = new Set<string>()
        seenByType.set(type, contents)
      }
      return contents
    }

    // 핀은 항상 보존한다. 같은 내용의 비핀은 핀보다 새로워도 중복으로 정리한다.
    this.items.filter((item) => item.pinned).forEach((item) => seenContents(item.type).add(item.content))

    const keptIds = new Set<string>()
    let removed = 0
    for (let index = this.items.length - 1; index >= 0; index--) {
      const item = this.items[index]
      if (!item) continue
      if (item.pinned) {
        keptIds.add(item.id)
        continue
      }
      const contents = seenContents(item.type)
      if (contents.has(item.content)) {
        removed++
        continue
      }
      contents.add(item.content)
      keptIds.add(item.id)
    }
    this.items = this.items.filter((item) => keptIds.has(item.id))
    return removed
  }

  /** 비핀 유지 개수(maxSize) 변경 — 설정 모달(D17). 즉시 ring buffer 규칙 재적용. */
  setMaxSize(n: number): void {
    this.maxSize = Math.max(1, Math.floor(n))
    this.evict()
  }

  /** 비핀 항목이 maxSize 를 넘으면 가장 오래된 비핀부터 제거. 핀은 건너뜀. */
  private evict(): void {
    let overflow = this.unpinnedCount - this.maxSize
    if (overflow <= 0) return
    this.items = this.items.filter((it) => {
      if (!it.pinned && overflow > 0) {
        overflow--
        return false
      }
      return true
    })
  }

  /**
   * 현재 상태를 JSON 파일로 저장한다.
   * - 호출 시점의 스냅샷을 만든 뒤 저장 큐에 넣어 겹치는 writeFile 을 막는다.
   * - 임시 파일을 완성한 뒤 교체해 종료/오류 중 기존 파일이 잘리는 위험을 줄인다.
   */
  save(): Promise<void> {
    const payload: PersistShape = { version: 1, items: this.items }
    const json = JSON.stringify(payload, null, 2)
    const encrypted = this.cipher.encrypt(json)
    const tempPath = `${this.filePath}.tmp`
    const operation = this.saveQueue.then(async () => {
      await fs.mkdir(dirname(this.filePath), { recursive: true })
      await fs.writeFile(tempPath, encrypted, 'utf8')
      await fs.rename(tempPath, this.filePath)
    })

    // 한 저장이 실패해도 다음 저장은 실행되게 큐 자체는 복구하고,
    // 현재 호출자에게는 원래 operation 을 반환해 실패를 관찰할 수 있게 한다.
    this.saveQueue = operation.catch(() => undefined)
    return operation
  }

  /** JSON 파일에서 재로딩. 파일 없으면 빈 상태로 시작. cipher 로 복호화(평문 파일은 그대로, D29). */
  async load(): Promise<void> {
    let raw: string
    try {
      raw = await fs.readFile(this.filePath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.items = []
        return
      }
      throw err
    }
    const parsed = JSON.parse(this.cipher.decrypt(raw)) as PersistShape
    this.items = Array.isArray(parsed.items) ? parsed.items : []
    this.seq = this.items.length
  }
}
