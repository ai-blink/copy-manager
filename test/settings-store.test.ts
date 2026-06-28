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

  it('(c) 저장 → 재로딩 라운드트립이 동일 상태를 복원한다', async () => {
    const filePath = tmpFile()
    const a = new SettingsStore(filePath)
    a.set({ cols: 4, remoteOpacity: 0.4, remoteMode: 'click', rebootReset: true })
    await a.save()

    const b = new SettingsStore(filePath)
    await b.load()
    expect(b.get().cols).toBe(4)
    expect(b.get().remoteOpacity).toBe(0.4)
    expect(b.get().remoteMode).toBe('click')
    expect(b.get().rebootReset).toBe(true)
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
  })
})
