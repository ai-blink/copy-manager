import { app, BrowserWindow, clipboard, ipcMain, nativeImage } from 'electron'
import { join } from 'node:path'
import {
  ClipboardStore,
  captureOnce,
  type ClipboardReader,
  type ClipItem
} from '../shared/clipboard-store'
import { SettingsStore, DEFAULT_SETTINGS, type AppSettings } from '../shared/settings'
import { createWindow, getWindow, setPinned, restoreLastActiveWindow } from './window'
import { registerHotkey, unregisterHotkey, reRegisterHotkey } from './hotkey'
import { sendCtrlV } from './paste'

const POLL_INTERVAL_MS = 800
const HISTORY_FILE = 'clip-history.json'
const SETTINGS_FILE = 'settings.json'
// 붙여넣기: 창을 숨기고 직전 앱에 포커스를 복원한 뒤, 안정화 시간을 두고 Ctrl+V 합성.
const PASTE_FOCUS_DELAY_MS = 180

// electron clipboard 로 ClipboardReader 포트를 구현(캡처 로직 자체는 shared 모듈에).
const electronReader: ClipboardReader = {
  readText: () => clipboard.readText(),
  readImageDataUrl: () => {
    const img = clipboard.readImage()
    return img.isEmpty() ? null : img.toDataURL()
  }
}

let store: ClipboardStore | null = null
let settings: SettingsStore | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function notifyRenderer(): void {
  getWindow()?.webContents.send('history:changed')
}

function notifySettings(s: AppSettings): void {
  getWindow()?.webContents.send('settings:changed', s)
}

/** 설정 변경의 main 측 부수효과 적용: 핫키 재등록 · 유지 개수 변경. */
function applySettingsSideEffects(prev: AppSettings, next: AppSettings, s: ClipboardStore): void {
  if (next.hotkey !== prev.hotkey) {
    if (!reRegisterHotkey(next.hotkey)) {
      console.warn('[copy-manager] 새 핫키 등록 실패(선점 가능):', next.hotkey)
    }
  }
  if (next.keepCount !== prev.keepCount) {
    s.setMaxSize(next.keepCount)
  }
}

function loadRenderer(win: BrowserWindow): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startCapturePolling(s: ClipboardStore): void {
  pollTimer = setInterval(() => {
    const added = captureOnce(electronReader, s)
    if (added) {
      void s.save()
      notifyRenderer() // S3: 새 항목 적재 시 렌더러 그리드 갱신
    }
  }, POLL_INTERVAL_MS)
}

/** id 항목을 OS 클립보드에 쓴다(텍스트/링크/코드=텍스트, 이미지=dataURL). */
function writeItemToClipboard(item: ClipItem): void {
  if (item.type === 'image') {
    clipboard.writeImage(nativeImage.createFromDataURL(item.content))
  } else {
    clipboard.writeText(item.content)
  }
}

function registerIpc(s: ClipboardStore): void {
  // 최소 IPC 표면만 노출(보안).
  ipcMain.handle('history:get', (): readonly ClipItem[] => s.getAll())

  ipcMain.on('pin:set', (_event, raw: unknown) => {
    setPinned(raw === true)
  })

  // 클릭=복사: 클립보드에 쓰기만(창 유지) — D12
  ipcMain.handle('clip:copy', (_event, rawId: unknown): boolean => {
    const item = s.getAll().find((i) => i.id === rawId)
    if (!item) return false
    writeItemToClipboard(item)
    return true
  })

  // Enter/더블클릭=붙여넣기: 클립보드에 쓴 뒤 창 숨기고 직전 앱에 Ctrl+V 합성 — D12 / S3e
  ipcMain.handle('clip:paste', async (_event, rawId: unknown): Promise<boolean> => {
    const item = s.getAll().find((i) => i.id === rawId)
    if (!item) return false
    writeItemToClipboard(item)
    getWindow()?.hide()
    await restoreLastActiveWindow() // 직전 앱 창에 포커스 복원(Windows 포그라운드 복귀)
    await delay(PASTE_FOCUS_DELAY_MS)
    await sendCtrlV()
    return true
  })

  // S5: 항목 핀 토글(카드 📌 / 우클릭 / 상세) — D7/D13. (window pin 인 pin:set 과 별개)
  ipcMain.handle('item:pin', async (_event, raw: unknown): Promise<boolean> => {
    const { id, pinned } = (raw ?? {}) as { id?: unknown; pinned?: unknown }
    if (typeof id !== 'string' || typeof pinned !== 'boolean') return false
    s.setPinned(id, pinned)
    await s.save()
    notifyRenderer()
    return true
  })

  // S5: 항목 삭제 — D13/D15(확인 모달은 렌더러에서 선행)
  ipcMain.handle('clip:delete', async (_event, rawId: unknown): Promise<boolean> => {
    if (typeof rawId !== 'string') return false
    s.remove(rawId)
    await s.save()
    notifyRenderer()
    return true
  })

  // S5: 모두 지우기(핀 제외) — D15
  ipcMain.handle('clip:clear', async (): Promise<boolean> => {
    s.clearUnpinned()
    await s.save()
    notifyRenderer()
    return true
  })

  // S5: 메모리 리셋(핀 포함 전체) — D15/D17
  ipcMain.handle('clip:reset', async (): Promise<boolean> => {
    s.clear()
    await s.save()
    notifyRenderer()
    return true
  })

  // S5: 설정 조회/변경 — D17
  ipcMain.handle('settings:get', (): AppSettings => settings?.get() ?? DEFAULT_SETTINGS)

  ipcMain.handle('settings:set', async (_event, raw: unknown): Promise<AppSettings> => {
    if (!settings) return DEFAULT_SETTINGS
    const prev = settings.get()
    const next = settings.set((raw ?? {}) as Partial<AppSettings>)
    applySettingsSideEffects(prev, next, s)
    await settings.save()
    if (next.keepCount !== prev.keepCount) {
      await s.save() // 유지 개수 축소로 축출됐을 수 있음
      notifyRenderer()
    }
    notifySettings(next)
    return next
  })
}

app.whenReady().then(async () => {
  const userData = app.getPath('userData')
  store = new ClipboardStore({ filePath: join(userData, HISTORY_FILE) })
  await store.load() // S2: 시작 시 재로딩

  // S5: 설정 로드. D17 "재부팅 시 기본값 리셋" 켜져 있으면 시작 시 초기화.
  settings = new SettingsStore(join(userData, SETTINGS_FILE))
  await settings.load()
  if (settings.get().rebootReset) {
    settings.resetToDefaults()
    await settings.save()
  }
  const cfg = settings.get()
  store.setMaxSize(cfg.keepCount) // 저장된 유지 개수 반영(필요 시 축출)
  await store.save()

  const win = createWindow()
  loadRenderer(win)
  registerIpc(store)

  if (!registerHotkey(cfg.hotkey)) {
    console.warn('[copy-manager] 전역 핫키 등록 실패(다른 앱이 선점했을 수 있음)')
  }
  startCapturePolling(store)

  app.on('activate', () => {
    if (getWindow() === null) {
      const w = createWindow()
      loadRenderer(w)
    }
  })
})

// 클립보드 매니저는 창을 닫아도 백그라운드 유지가 자연스럽지만,
// S1~S3 단계에서는 단순화: 모든 창이 닫히면 종료(트레이는 후속 슬라이스).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  unregisterHotkey()
  if (pollTimer) clearInterval(pollTimer)
})
