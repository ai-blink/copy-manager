import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SettingsStore, DEFAULT_SETTINGS } from '../src/shared/settings'

const tmpFiles: string[] = []
function tmpFile(): string {
  const p = join(tmpdir(), `cm-settings-${randomUUID()}.json`)
  tmpFiles.push(p)
  return p
}

afterEach(async () => {
  await Promise.all(tmpFiles.splice(0).map((p) => fs.rm(p, { force: true })))
})

describe('SettingsStore (D17)', () => {
  it('(a) 파일이 없으면 기본값으로 로딩된다', async () => {
    const s = new SettingsStore(tmpFile())
    await s.load()
    expect(s.get()).toEqual(DEFAULT_SETTINGS)
  })

  it('(b) set 은 일부 키만 갱신하고 나머지는 유지한다', () => {
    const s = new SettingsStore(tmpFile())
    const next = s.set({ cols: 5, keepCount: 120 })
    expect(next.cols).toBe(5)
    expect(next.keepCount).toBe(120)
    expect(next.hotkey).toBe(DEFAULT_SETTINGS.hotkey) // 미변경 키 유지
  })

  it('(b-2) keepCount 는 1~1000 정수 범위로 보정한다', () => {
    const s = new SettingsStore(tmpFile())

    expect(s.set({ keepCount: 0 }).keepCount).toBe(1)
    expect(s.set({ keepCount: 1000.8 }).keepCount).toBe(1000)
    expect(s.set({ keepCount: 2000 }).keepCount).toBe(1000)
  })

  it('(c) 저장 → 재로딩 라운드트립이 동일 상태를 복원한다', async () => {
    const filePath = tmpFile()
    const a = new SettingsStore(filePath)
    a.set({
      cols: 4,
      remoteOpacity: 0.4,
      remoteMode: 'click',
      rebootReset: true,
      uiScale: 1.25,
      windowPlacement: 'bottom-right',
      windowPosition: { x: 1480, y: 220 },
      alwaysOnTop: false,
      contentProtection: false // 기본 true 와 다른 값으로 라운드트립 확인 (D28)
    })
    await a.save()

    const b = new SettingsStore(filePath)
    await b.load()
    expect(b.get().cols).toBe(4)
    expect(b.get().remoteOpacity).toBe(0.4)
    expect(b.get().remoteMode).toBe('click')
    expect(b.get().rebootReset).toBe(true)
    expect(b.get().uiScale).toBe(1.25)
    expect(b.get().windowPlacement).toBe('bottom-right')
    expect(b.get().windowPosition).toEqual({ x: 1480, y: 220 })
    expect(b.get().alwaysOnTop).toBe(false)
    expect(b.get().contentProtection).toBe(false)
  })

  it('(d) resetToDefaults 는 기본값으로 되돌리되 rebootReset 플래그는 유지한다', () => {
    const s = new SettingsStore(tmpFile())
    s.set({ cols: 5, dwellMs: 1500, rebootReset: true })

    const reset = s.resetToDefaults()

    expect(reset.cols).toBe(DEFAULT_SETTINGS.cols)
    expect(reset.dwellMs).toBe(DEFAULT_SETTINGS.dwellMs)
    expect(reset.rebootReset).toBe(true) // 켜둔 채 재시작 시 계속 리셋되도록 유지
  })

  it('(e) 누락 키는 기본값으로 보강된다(전방 호환)', async () => {
    const filePath = tmpFile()
    // cols 만 들어 있는 구버전 파일 시뮬레이션
    await fs.writeFile(filePath, JSON.stringify({ version: 1, settings: { cols: 2 } }), 'utf8')

    const s = new SettingsStore(filePath)
    await s.load()
    expect(s.get().cols).toBe(2)
    expect(s.get().keepCount).toBe(DEFAULT_SETTINGS.keepCount) // 누락 → 기본값
    expect(s.get().hotkey).toBe(DEFAULT_SETTINGS.hotkey)
    expect(s.get().keepOpen).toBe(true) // 신규 키 누락 → 기본값 true(창 유지)
    expect(s.get().uiScale).toBe(1) // 신규 키 누락 → 기본값 100%(원래 크기)
    expect(s.get().windowPlacement).toBe('center') // 신규 키 누락 → 기본값 중앙
    expect(s.get().windowPosition).toBeNull() // 신규 키 누락 → 9분할 배치값을 사용
    expect(s.get().alwaysOnTop).toBe(true) // 신규 키 누락 → 기본값 true(항상 위)
    expect(s.get().contentProtection).toBe(true) // 신규 키 누락 → 기본값 true(보안 우선, D28)
  })

  it('(e-2) v1에 저장된 이전 기본값 50은 새 기본값 100으로 마이그레이션한다', async () => {
    const filePath = tmpFile()
    await fs.writeFile(
      filePath,
      JSON.stringify({ version: 1, settings: { keepCount: 50 } }),
      'utf8'
    )

    const s = new SettingsStore(filePath)
    await s.load()

    expect(s.get().keepCount).toBe(100)
    expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toMatchObject({ version: 2 })

    s.set({ keepCount: 50 })
    await s.save()
    const reloaded = new SettingsStore(filePath)
    await reloaded.load()
    expect(reloaded.get().keepCount).toBe(50)
  })
})

describe('복사 토스트 설정 (D34)', () => {
  it('(t-1) 기본값은 후보 비교에서 고른 보라 배색과 0.31 불투명도다', () => {
    expect(DEFAULT_SETTINGS.toastTheme).toBe('accent')
    expect(DEFAULT_SETTINGS.toastOpacity).toBe(0.31)
    expect(DEFAULT_SETTINGS.toastFontSize).toBe(13)
    expect(DEFAULT_SETTINGS.toastPadY).toBe(10)
    expect(DEFAULT_SETTINGS.toastPadX).toBe(18)
  })

  it('(t-2) 범위를 벗어난 값은 최소·최대로 보정된다', () => {
    const store = new SettingsStore(tmpFile())
    const low = store.set({ toastOpacity: 0.05, toastFontSize: 4, toastPadY: 0, toastPadX: 2 })
    expect(low.toastOpacity).toBe(0.25)
    expect(low.toastFontSize).toBe(11)
    expect(low.toastPadY).toBe(6)
    expect(low.toastPadX).toBe(10)

    const high = store.set({ toastOpacity: 3, toastFontSize: 99, toastPadY: 99, toastPadX: 99 })
    expect(high.toastOpacity).toBe(1)
    expect(high.toastFontSize).toBe(17)
    expect(high.toastPadY).toBe(16)
    expect(high.toastPadX).toBe(28)
  })

  it('(t-3) 알 수 없는 배색은 기존 값을 유지한다', () => {
    const store = new SettingsStore(tmpFile())
    store.set({ toastTheme: 'mint' })
    // 'purple' 은 후보에 없는 값 — 잘못된 설정 파일/입력 방어
    const next = store.set({ toastTheme: 'purple' as never })
    expect(next.toastTheme).toBe('mint')
  })

  it('(t-4) 저장-재로딩 라운드트립에서 토스트 설정이 보존된다', async () => {
    const path = tmpFile()
    const store = new SettingsStore(path)
    store.set({ toastTheme: 'black', toastOpacity: 0.42, toastFontSize: 16 })
    await store.save()

    const reloaded = new SettingsStore(path)
    await reloaded.load()
    const s = reloaded.get()
    expect(s.toastTheme).toBe('black')
    expect(s.toastOpacity).toBe(0.42)
    expect(s.toastFontSize).toBe(16)
  })

  it('(t-5) 토스트 키가 없는 구버전 파일은 기본값으로 보강된다', async () => {
    const path = tmpFile()
    await fs.writeFile(
      path,
      JSON.stringify({ version: 2, settings: { cols: 4, keepCount: 200 } }),
      'utf8'
    )
    const store = new SettingsStore(path)
    await store.load()
    const s = store.get()
    expect(s.cols).toBe(4)
    expect(s.toastTheme).toBe(DEFAULT_SETTINGS.toastTheme)
    expect(s.toastOpacity).toBe(DEFAULT_SETTINGS.toastOpacity)
  })
})
