import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ClipboardStore, classifyText } from '../src/shared/clipboard-store'

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
})
