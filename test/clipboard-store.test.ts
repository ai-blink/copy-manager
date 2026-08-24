import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ClipboardStore, captureOnce, classifyText, type Cipher } from '../src/shared/clipboard-store'

// 각 테스트가 독립 임시 파일을 쓰도록 추적 후 정리.
const tmpFiles: string[] = []
function tmpFile(): string {
  const p = join(tmpdir(), `cm-store-${randomUUID()}.json`)
  tmpFiles.push(p)
  return p
}

afterEach(async () => {
  await Promise.all(
    tmpFiles.splice(0).map((p) => fs.rm(p, { force: true }))
  )
})

/** maxSize=50 store 생성 헬퍼. */
function newStore(): ClipboardStore {
  return new ClipboardStore({ filePath: tmpFile(), maxSize: 50 })
}

describe('ClipboardStore ring buffer (D7)', () => {
  it('(a) 51번째 항목이 가장 오래된 비핀 항목을 축출한다', () => {
    const store = newStore()
    for (let i = 0; i < 50; i++) {
      store.add({ content: `item-${i}`, type: 'text', createdAt: 1000 + i })
    }
    expect(store.size).toBe(50)
    expect(store.getAll()[0]?.content).toBe('item-0')

    // 51번째
    store.add({ content: 'item-50', type: 'text', createdAt: 1100 })

    expect(store.size).toBe(50)
    expect(store.unpinnedCount).toBe(50)
    // 가장 오래된 item-0 이 축출되고 item-1 이 선두
    expect(store.getAll()[0]?.content).toBe('item-1')
    expect(store.getAll().some((i) => i.content === 'item-0')).toBe(false)
    expect(store.latest()?.content).toBe('item-50')
  })

  it('(b) 핀 항목은 50 카운트에 미포함된다', () => {
    const store = newStore()
    // 핀 1개 먼저
    store.add({ content: 'PINNED', type: 'text', pinned: true, createdAt: 1 })
    // 비핀 50개
    for (let i = 0; i < 50; i++) {
      store.add({ content: `n-${i}`, type: 'text', createdAt: 100 + i })
    }
    expect(store.unpinnedCount).toBe(50) // 비핀만 카운트
    expect(store.size).toBe(51) // 핀 포함 총 51
    // 핀이 카운트에서 빠졌으므로 비핀 50개 모두 생존(축출 0)
    expect(store.getAll().some((i) => i.content === 'n-0')).toBe(true)
  })

  it('(c) 핀 항목은 축출에서 생존한다', () => {
    const store = newStore()
    // 가장 오래된 항목을 핀으로
    const pinned = store.add({ content: 'OLD-PINNED', type: 'text', pinned: true, createdAt: 1 })
    // 비핀 50개 → 비핀 카운트 50 (축출 없음)
    for (let i = 0; i < 50; i++) {
      store.add({ content: `u-${i}`, type: 'text', createdAt: 100 + i })
    }
    // 51번째 비핀 → overflow 1, 가장 오래된 '비핀'(u-0) 축출, 핀은 건너뜀
    store.add({ content: 'u-50', type: 'text', createdAt: 200 })

    expect(store.unpinnedCount).toBe(50)
    // 핀 항목 생존
    expect(store.getAll().some((i) => i.id === pinned.id)).toBe(true)
    // 가장 오래된 비핀(u-0)은 축출
    expect(store.getAll().some((i) => i.content === 'u-0')).toBe(false)
    // u-1 은 생존
    expect(store.getAll().some((i) => i.content === 'u-1')).toBe(true)
  })

  it('(c-2) 제한 200개에서 새 항목은 가장 오래된 비핀을 교체하고 최신으로 남는다', () => {
    const store = new ClipboardStore({ filePath: tmpFile(), maxSize: 200 })
    for (let i = 0; i < 200; i++) {
      store.add({ content: `item-${i}`, createdAt: 1_000 + i })
    }

    const newest = store.add({ content: 'brand-new-at-limit', createdAt: 2_000 })

    expect(store.unpinnedCount).toBe(200)
    expect(store.size).toBe(200)
    expect(store.getAll().some((item) => item.content === 'item-0')).toBe(false)
    expect(store.latest()?.id).toBe(newest.id)
    expect(store.latest()?.content).toBe('brand-new-at-limit')
  })
})

describe('classifyText 타입 분류 (D16)', () => {
  it('(d) text / link / code / image 분류가 매핑된다', () => {
    expect(classifyText('https://example.com/path?q=1')).toBe('link')
    expect(classifyText('const x = 1;\nfunction f() { return x }')).toBe('code')
    expect(classifyText('오늘 장보기 메모: 우유, 계란')).toBe('text')
    expect(classifyText('')).toBe('text')

    // image 는 캡처 시점에 명시 지정 → add 가 그대로 반영
    const store = newStore()
    const img = store.add({ type: 'image', content: 'data:image/png;base64,AAAA' })
    expect(img.type).toBe('image')

    // type 미지정 add 는 classifyText 결과를 사용
    const link = store.add({ content: 'http://localhost:3000' })
    expect(link.type).toBe('link')
  })

  it('(d-2) captureOnce 는 호출자가 지정한 현재 클립보드 항목을 적재하지 않는다', () => {
    const store = newStore()
    const reader = {
      readText: () => 'deduplicated',
      readImageDataUrl: () => null
    }

    const added = captureOnce(reader, store, (type, content) => type === 'text' && content === 'deduplicated')

    expect(added).toBeNull()
    expect(store.size).toBe(0)
  })
})

describe('JSON 영속화 (S2)', () => {
  it('(e) 저장 → 재로딩 라운드트립이 동일 상태를 복원한다', async () => {
    const filePath = tmpFile()
    const a = new ClipboardStore({ filePath, maxSize: 50 })
    a.add({ content: 'first', type: 'text', createdAt: 10 })
    a.add({ content: 'https://pinned.example', pinned: true, createdAt: 20 })
    a.add({ content: 'const y = 2;', createdAt: 30 })
    await a.save()

    const b = new ClipboardStore({ filePath, maxSize: 50 })
    await b.load()

    expect(b.size).toBe(a.size)
    expect(b.getAll()).toEqual(a.getAll())
    // 핀 상태와 타입도 보존
    const reloadedPin = b.getAll().find((i) => i.content === 'https://pinned.example')
    expect(reloadedPin?.pinned).toBe(true)
    expect(reloadedPin?.type).toBe('link')
  })

  it('(e-2) 파일이 없으면 빈 상태로 로딩된다', async () => {
    const store = new ClipboardStore({ filePath: tmpFile(), maxSize: 50 })
    await store.load()
    expect(store.size).toBe(0)
  })

  it('(e-3) 겹쳐 요청한 저장도 호출 순서대로 반영해 마지막 스냅샷을 보존한다', async () => {
    const filePath = tmpFile()
    const store = new ClipboardStore({ filePath, maxSize: 50 })
    store.add({ content: 'first', createdAt: 1 })
    const firstSave = store.save()
    store.add({ content: 'second', createdAt: 2 })
    const secondSave = store.save()

    await Promise.all([firstSave, secondSave])

    const reloaded = new ClipboardStore({ filePath, maxSize: 50 })
    await reloaded.load()
    expect(reloaded.getAll().map((item) => item.content)).toEqual(['first', 'second'])
    await expect(fs.stat(`${filePath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('ClipboardStore S5 메서드 (삭제/모두지우기/유지개수)', () => {
  it('(f) clearUnpinned 는 핀만 남기고 비핀을 모두 지운다 (D15)', () => {
    const store = newStore()
    store.add({ content: 'a', type: 'text', createdAt: 1 })
    store.add({ content: 'KEEP', type: 'text', pinned: true, createdAt: 2 })
    store.add({ content: 'b', type: 'text', createdAt: 3 })

    store.clearUnpinned()

    expect(store.size).toBe(1)
    expect(store.getAll()[0]?.content).toBe('KEEP')
    expect(store.unpinnedCount).toBe(0)
  })

  it('(g) clear 는 핀 포함 전체를 비운다 (메모리 리셋, D17)', () => {
    const store = newStore()
    store.add({ content: 'a', type: 'text', createdAt: 1 })
    store.add({ content: 'PIN', type: 'text', pinned: true, createdAt: 2 })

    store.clear()

    expect(store.size).toBe(0)
  })

  it('(h) setMaxSize 축소 시 즉시 오래된 비핀부터 축출, 핀은 보존', () => {
    const store = newStore()
    store.add({ content: 'PIN', type: 'text', pinned: true, createdAt: 1 })
    for (let i = 0; i < 5; i++) store.add({ content: `n-${i}`, type: 'text', createdAt: 10 + i })
    expect(store.unpinnedCount).toBe(5)

    store.setMaxSize(2) // 비핀 5 → 2 (n-0,n-1,n-2 축출)

    expect(store.unpinnedCount).toBe(2)
    expect(store.getAll().some((i) => i.content === 'PIN')).toBe(true) // 핀 생존
    expect(store.getAll().some((i) => i.content === 'n-0')).toBe(false)
    expect(store.getAll().some((i) => i.content === 'n-4')).toBe(true) // 최신 비핀 생존
  })

  it('(i) remove 는 지정 id 만 삭제한다', () => {
    const store = newStore()
    const a = store.add({ content: 'a', type: 'text', createdAt: 1 })
    store.add({ content: 'b', type: 'text', createdAt: 2 })

    store.remove(a.id)

    expect(store.size).toBe(1)
    expect(store.getAll().some((i) => i.id === a.id)).toBe(false)
  })

  it('(i-2) removeDuplicates 는 최신 비핀만 남기고 핀 항목은 보존한다', () => {
    const store = newStore()
    store.add({ content: 'same', type: 'text', createdAt: 10 })
    const latest = store.add({ content: 'same', type: 'text', createdAt: 30 })
    store.add({ content: 'same', type: 'link', createdAt: 40 })
    store.add({ content: 'pin-same', type: 'text', pinned: true, createdAt: 50 })
    store.add({ content: 'pin-same', type: 'text', createdAt: 60 })

    const removed = store.removeDuplicates()

    expect(removed).toBe(2)
    expect(store.getAll().some((i) => i.id === latest.id)).toBe(true)
    expect(store.getAll().filter((i) => i.content === 'same' && i.type === 'text')).toHaveLength(1)
    expect(store.getAll().some((i) => i.content === 'same' && i.type === 'link')).toBe(true)
    expect(store.getAll().some((i) => i.pinned && i.content === 'pin-same')).toBe(true)
    expect(store.getAll().some((i) => !i.pinned && i.content === 'pin-same')).toBe(false)
  })
})

describe('저장 암호화 cipher 포트 (D29)', () => {
  // safeStorage 대신 electron 없이 검증하는 테스트 cipher.
  // 실제 DPAPI cipher 와 동일한 의미: base64 봉투로 감싸고, 봉투 없는 평문은 그대로 통과(마이그레이션).
  const b64Cipher: Cipher = {
    encrypt: (plain) => JSON.stringify({ enc: Buffer.from(plain, 'utf8').toString('base64') }),
    decrypt: (stored) => {
      try {
        const o = JSON.parse(stored) as { enc?: unknown }
        if (typeof o.enc === 'string') return Buffer.from(o.enc, 'base64').toString('utf8')
      } catch {
        /* 봉투 아님 → 평문 통과 */
      }
      return stored
    }
  }

  it('(j) cipher 주입 시 파일은 평문이 아니고, 라운드트립으로 동일 상태를 복원한다', async () => {
    const filePath = tmpFile()
    const a = new ClipboardStore({ filePath, maxSize: 50, cipher: b64Cipher })
    a.add({ content: 'secret-token-XYZ', type: 'text', createdAt: 10 })
    a.add({ content: 'https://pinned.example', pinned: true, createdAt: 20 })
    await a.save()

    // 디스크 내용에 평문 민감값이 노출되지 않아야 함
    const onDisk = await fs.readFile(filePath, 'utf8')
    expect(onDisk).not.toContain('secret-token-XYZ')

    // 같은 cipher 로 재로딩 시 원상 복원
    const b = new ClipboardStore({ filePath, maxSize: 50, cipher: b64Cipher })
    await b.load()
    expect(b.getAll()).toEqual(a.getAll())
    expect(b.getAll().some((i) => i.content === 'secret-token-XYZ')).toBe(true)
  })

  it('(k) 구 평문 파일을 cipher 로 로딩하면 통과되고(마이그레이션), 이후 save 는 암호화된다', async () => {
    const filePath = tmpFile()
    // 구버전: cipher 없이 평문 저장
    const legacy = new ClipboardStore({ filePath, maxSize: 50 })
    legacy.add({ content: 'legacy-secret', type: 'text', createdAt: 1 })
    await legacy.save()
    expect(await fs.readFile(filePath, 'utf8')).toContain('legacy-secret') // 평문 확인

    // cipher 주입 store 가 평문 파일을 정상 로딩(마이그레이션 진입)
    const migrated = new ClipboardStore({ filePath, maxSize: 50, cipher: b64Cipher })
    await migrated.load()
    expect(migrated.getAll().some((i) => i.content === 'legacy-secret')).toBe(true)

    // 이후 save 는 암호화 → 디스크에 평문 미노출
    await migrated.save()
    expect(await fs.readFile(filePath, 'utf8')).not.toContain('legacy-secret')
  })
})

describe('재복사 승격 · 중복 카드 방지 (D34)', () => {
  it('(e-1) promote 는 카드를 새로 만들지 않고 맨 앞으로 옮긴다(개수·id·핀 유지)', () => {
    const store = newStore()
    const a = store.add({ content: 'a' })
    const b = store.add({ content: 'b' })
    const c = store.add({ content: 'c' })
    store.setPinned(a.id, true)

    const promoted = store.promote(a.id)

    expect(promoted?.id).toBe(a.id)
    expect(promoted?.pinned).toBe(true) // 핀 상태는 승격으로 바뀌지 않는다
    expect(store.size).toBe(3) // 카드가 늘지 않는다
    expect(store.getAll().map((i) => i.content)).toEqual(['b', 'c', 'a'])
    expect(store.latest()?.id).toBe(a.id)
    expect(b.id).not.toBe(c.id)
  })

  it('(e-2) promote 는 없는 id 에 undefined 를 반환하고 히스토리를 건드리지 않는다', () => {
    const store = newStore()
    store.add({ content: 'a' })

    expect(store.promote('없는-id')).toBeUndefined()
    expect(store.getAll().map((i) => i.content)).toEqual(['a'])
  })

  it('(e-3) 히스토리 중간 항목과 같은 내용을 다시 복사하면 중복 카드 대신 승격된다', () => {
    const store = newStore()
    const first = store.add({ content: 'hello' })
    store.add({ content: 'foo' })
    store.add({ content: 'world' })

    const captured = captureOnce({ readText: () => 'hello', readImageDataUrl: () => null }, store)

    expect(captured?.id).toBe(first.id) // 새 카드가 아니라 원래 카드
    expect(store.size).toBe(3)
    expect(store.getAll().map((i) => i.content)).toEqual(['foo', 'world', 'hello'])
  })

  it('(e-4) 맨 앞 항목과 같은 내용이면 아무 변화 없이 null(폴링 노이즈)', () => {
    const store = newStore()
    store.add({ content: 'foo' })
    const last = store.add({ content: 'hello' })
    const before = last.createdAt

    const captured = captureOnce({ readText: () => 'hello', readImageDataUrl: () => null }, store)

    expect(captured).toBeNull()
    expect(store.size).toBe(2)
    expect(store.latest()?.createdAt).toBe(before) // 승격도 일어나지 않는다
  })

  it('(e-5) 이미지도 같은 dataURL 이면 중복 카드 대신 승격된다', () => {
    const store = newStore()
    const img = store.add({ type: 'image', content: 'data:image/png;base64,AAAA' })
    store.add({ content: 'text-after' })

    const captured = captureOnce(
      { readText: () => '', readImageDataUrl: () => 'data:image/png;base64,AAAA' },
      store
    )

    expect(captured?.id).toBe(img.id)
    expect(store.size).toBe(2)
    expect(store.latest()?.type).toBe('image')
  })

  it('(e-6) 승격은 개수를 늘리지 않으므로 ring buffer 축출을 유발하지 않는다', () => {
    const store = newStore() // maxSize=50
    for (let i = 0; i < 50; i++) store.add({ content: `item-${i}` })

    captureOnce({ readText: () => 'item-0', readImageDataUrl: () => null }, store)

    expect(store.size).toBe(50) // 51번째 카드가 생기지 않아 축출도 없다
    expect(store.getAll()[0]?.content).toBe('item-1')
    expect(store.latest()?.content).toBe('item-0')
  })

  it('(e-7) 다른 내용은 그대로 새 카드로 적재된다', () => {
    const store = newStore()
    store.add({ content: 'hello' })

    const captured = captureOnce({ readText: () => 'brand-new', readImageDataUrl: () => null }, store)

    expect(captured?.content).toBe('brand-new')
    expect(store.size).toBe(2)
  })
})
