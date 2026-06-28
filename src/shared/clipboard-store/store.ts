import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { AddInput, ClipItem, PersistShape } from './types'
import { classifyText } from './classify'

export interface ClipboardStoreOptions {
  /** JSON 영속화 파일 경로 */
  filePath: string
  /** 비핀 항목 최대 보유 수 (기본 50, D7) */
  maxSize?: number
}

const DEFAULT_MAX = 50

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

  constructor(opts: ClipboardStoreOptions) {
    this.filePath = opts.filePath
    this.maxSize = opts.maxSize ?? DEFAULT_MAX
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

  /** 현재 상태를 JSON 파일로 저장(디렉토리 없으면 생성). */
  async save(): Promise<void> {
    const payload: PersistShape = { version: 1, items: this.items }
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  /** JSON 파일에서 재로딩. 파일 없으면 빈 상태로 시작. */
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
    const parsed = JSON.parse(raw) as PersistShape
    this.items = Array.isArray(parsed.items) ? parsed.items : []
    this.seq = this.items.length
  }
}
