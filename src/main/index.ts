import { app, BrowserWindow, clipboard, ipcMain, nativeImage } from 'electron'
import { join } from 'node:path'
import {
  ClipboardStore,
  captureOnce,
  type ClipboardReader,
  type ClipItem
} from '../shared/clipboard-store'
import { createWindow, getWindow, setPinned, restoreLastActiveWindow } from './window'
import { registerHotkey, unregisterHotkey } from './hotkey'
import { sendCtrlV } from './paste'

const POLL_INTERVAL_MS = 800
const HISTORY_FILE = 'clip-history.json'
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
let pollTimer: ReturnType<typeof setInterval> | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function notifyRenderer(): void {
  getWindow()?.webContents.send('history:changed')
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
}

app.whenReady().then(async () => {
  store = new ClipboardStore({ filePath: join(app.getPath('userData'), HISTORY_FILE) })
  await store.load() // S2: 시작 시 재로딩

  const win = createWindow()
  loadRenderer(win)
  registerIpc(store)

  if (!registerHotkey()) {
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
