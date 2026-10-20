import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClipboardWatcherCallbacks } from '../src/main/clipboard-watcher'
import type { ClipboardReader } from '../src/shared/clipboard-store'

const mocks = vi.hoisted(() => ({
  watchers: [] as ClipboardWatcherCallbacks[],
  capture: vi.fn((_reader: ClipboardReader, ..._args: unknown[]) => null),
  stop: vi.fn(),
  events: new Map<string, () => void>()
}))

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    on: (event: string, callback: () => void) => mocks.events.set(event, callback),
    getPath: () => 'unused-test-profile',
    getLocale: () => 'ko',
    getVersion: () => 'test',
    isPackaged: false
  },
  clipboard: {},
  ipcMain: { handle: vi.fn(), on: vi.fn() }
}))

vi.mock('../src/main/window', () => ({
  createWindow: () => ({ setTitle: vi.fn(), loadFile: vi.fn(), on: vi.fn() }),
  getWindow: () => null,
  setKeepOpen: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  setUiScale: vi.fn(),
  setWindowPlacement: vi.fn(),
  setWindowPosition: vi.fn(),
  setContentProtection: vi.fn()
}))
vi.mock('../src/main/hotkey', () => ({ registerHotkey: () => true, unregisterHotkey: vi.fn() }))
vi.mock('../src/main/paste', () => ({}))
vi.mock('../src/main/cipher', () => ({ createSafeStorageCipher: vi.fn() }))
vi.mock('../src/main/clipboard-watcher', () => ({
  startWindowsClipboardWatcher: (callbacks: ClipboardWatcherCallbacks) => {
    mocks.watchers.push(callbacks)
    return { stop: mocks.stop }
  }
}))
vi.mock('../src/shared/clipboard-store', () => ({
  ClipboardStore: class {
    async load(): Promise<void> {}
    async save(): Promise<void> {}
    setMaxSize(): void {}
  },
  captureOnce: mocks.capture
}))
vi.mock('../src/shared/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/settings')>()
  return {
    ...actual,
    SettingsStore: class {
      async load(): Promise<void> {}
      get(): typeof actual.DEFAULT_SETTINGS { return actual.DEFAULT_SETTINGS }
    }
  }
})

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mocks.watchers.length = 0
  mocks.events.clear()
  mocks.capture.mockClear()
  mocks.stop.mockClear()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  await import('../src/main/index')
  await vi.waitFor(() => expect(mocks.watchers).toHaveLength(1))
  mocks.capture.mockClear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('클립보드 감시 CPU 부하 회귀', () => {
  it('준비 중에는 250ms, READY 이후에는 60초에 12회만 안전망 캡처한다', () => {
    vi.advanceTimersByTime(1_000)
    expect(mocks.capture).toHaveBeenCalledTimes(4)
    mocks.watchers[0].onReady?.()
    mocks.capture.mockClear()
    vi.advanceTimersByTime(60_000)
    expect(mocks.capture).toHaveBeenCalledTimes(12)
  })

  it('정상 상태에서도 변경 알림은 즉시 처리하고 연속 텍스트 스냅샷을 보존한다', () => {
    mocks.watchers[0].onReady?.()
    mocks.watchers[0].onChange('첫 복사')
    mocks.watchers[0].onChange('두 번째 복사')
    expect(mocks.capture).toHaveBeenCalledTimes(2)
    expect(mocks.capture.mock.calls[0][0].readText()).toBe('첫 복사')
    expect(mocks.capture.mock.calls[1][0].readText()).toBe('두 번째 복사')
    expect(mocks.capture.mock.calls[0][0].readImageDataUrl()).toBeNull()
  })

  it('장애 중에는 250ms로 돌아가고 재시작 준비 후에는 느린 안전망으로 복귀한다', () => {
    mocks.watchers[0].onReady?.()
    mocks.watchers[0].onError?.(new Error('test watcher failure'))
    expect(mocks.stop).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2_000)
    expect(mocks.capture).toHaveBeenCalledTimes(8)
    expect(mocks.watchers).toHaveLength(2)
    mocks.watchers[1].onReady?.()
    mocks.capture.mockClear()
    vi.advanceTimersByTime(5_000)
    expect(mocks.capture).toHaveBeenCalledTimes(1)
  })

  it('종료 시 감시와 폴링을 정지한다', () => {
    mocks.watchers[0].onReady?.()
    mocks.events.get('will-quit')?.()
    vi.advanceTimersByTime(60_000)
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalledTimes(1)
  })
})
