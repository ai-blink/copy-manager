import { app, BrowserWindow, clipboard, ipcMain, nativeImage } from 'electron'
import { join } from 'node:path'
import {
  ClipboardStore,
  captureOnce,
  classifyText,
  type ClipboardReader,
  type ClipItem
} from '../shared/clipboard-store'
import {
  SettingsStore,
  DEFAULT_SETTINGS,
  type AppSettings,
  type WindowPosition
} from '../shared/settings'
import {
  createWindow,
  getWindow,
  setKeepOpen,
  setAlwaysOnTop,
  setUiScale,
  setWindowPlacement,
  setWindowPosition,
  getWindowPosition,
  setContentProtection,
  hideWindow,
  toggleAlwaysOnTop,
  restoreLastActiveWindow
} from './window'
import { registerHotkey, unregisterHotkey, replaceHotkey } from './hotkey'
import { sendCtrlV } from './paste'
import { createSafeStorageCipher } from './cipher'
import {
  startWindowsClipboardWatcher,
  type ClipboardWatcherHandle
} from './clipboard-watcher'

// 빠른 연속 복사 누락을 줄인다. 저장은 아래에서 디바운스하므로 폴링과 디스크 쓰기를 분리한다.
const POLL_INTERVAL_MS = 250
const HISTORY_SAVE_DEBOUNCE_MS = 350
const HISTORY_FILE = 'clip-history.json'
const SETTINGS_FILE = 'settings.json'
// 붙여넣기: 창을 숨기고 직전 앱에 포커스를 복원한 뒤, 안정화 시간을 두고 Ctrl+V 합성.
const PASTE_FOCUS_DELAY_MS = 180
// 헤더를 드래그하는 동안 설정 파일을 계속 쓰지 않도록, 멈춘 뒤 한 번만 저장한다.
const WINDOW_POSITION_SAVE_DELAY_MS = 250

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
let clipboardWatcher: ClipboardWatcherHandle | null = null
let historySaveTimer: ReturnType<typeof setTimeout> | null = null
let windowPositionTimer: ReturnType<typeof setTimeout> | null = null
let suppressedCapture: Pick<ClipItem, 'type' | 'content'> | null = null
let historyFlushedForQuit = false

function getAppInfo(): { version: string; mode: string } {
  return {
    version: app.getVersion(),
    mode: app.isPackaged ? '패키지 실행' : '개발 실행'
  }
}

function getWindowTitle(): string {
  const { version, mode } = getAppInfo()
  return `copy-manager v${version} · ${mode}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function notifyRenderer(): void {
  getWindow()?.webContents.send('history:changed')
}

function notifySettings(s: AppSettings): void {
  getWindow()?.webContents.send('settings:changed', s)
}

function isSameWindowPosition(a: WindowPosition | null, b: WindowPosition): boolean {
  return a?.x === b.x && a.y === b.y
}

/** 헤더 드래그가 멈춘 뒤 실제 좌표를 저장한다. */
async function persistWindowPosition(): Promise<void> {
  const position = getWindowPosition()
  if (!settings || !position || isSameWindowPosition(settings.get().windowPosition, position)) return

  setWindowPosition(position)
  const next = settings.set({ windowPosition: position })
  await settings.save()
  notifySettings(next)
}

function scheduleWindowPositionSave(): void {
  if (windowPositionTimer) clearTimeout(windowPositionTimer)
  windowPositionTimer = setTimeout(() => {
    windowPositionTimer = null
    void persistWindowPosition().catch((err: unknown) => {
      console.warn('[copy-manager] 창 위치 저장 실패:', err)
    })
  }, WINDOW_POSITION_SAVE_DELAY_MS)
}

function watchWindowPosition(win: BrowserWindow): void {
  win.on('move', scheduleWindowPositionSave)
}

/**
 * D30: 윈도우 시작(로그인) 시 자동 실행을 OS 로그인 항목에 반영.
 * Windows 에서는 `HKCU\...\Run` 레지스트리에 실행 파일 경로를 등록/해제한다.
 * dev(비패키징)에서는 execPath 가 electron.exe 라 자동 실행이 무의미 → 스킵(설정값은 저장됨).
 */
function applyLaunchAtStartup(enabled: boolean): void {
  if (!app.isPackaged) {
    console.warn('[copy-manager] launchAtStartup 는 패키징(빌드)된 앱에서만 반영됩니다(dev 스킵).')
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled })
}

/** 설정 변경의 main 측 부수효과 적용: 유지 개수·창 동작 등. 핫키는 전용 IPC에서 원자적으로 처리한다. */
function applySettingsSideEffects(prev: AppSettings, next: AppSettings, s: ClipboardStore): void {
  if (next.keepCount !== prev.keepCount) {
    s.setMaxSize(next.keepCount)
  }
  if (next.keepOpen !== prev.keepOpen) {
    setKeepOpen(next.keepOpen)
  }
  if (next.uiScale !== prev.uiScale) {
    setUiScale(next.uiScale)
  }
  if (next.windowPlacement !== prev.windowPlacement) {
    setWindowPlacement(next.windowPlacement)
  }
  if (next.contentProtection !== prev.contentProtection) {
    setContentProtection(next.contentProtection) // D28: 캡처 방지 즉시 반영
  }
  if (next.launchAtStartup !== prev.launchAtStartup) {
    applyLaunchAtStartup(next.launchAtStartup) // D30: 자동 실행 즉시 반영
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

function captureCurrentClipboard(s: ClipboardStore): void {
  try {
    const added = captureOnce(electronReader, s, (type, content) => {
      if (!suppressedCapture) return false
      if (suppressedCapture.type === type && suppressedCapture.content === content) return true
      suppressedCapture = null
      return false
    })
    if (added) {
      scheduleHistorySave(s)
      notifyRenderer() // S3: 새 항목 적재 시 렌더러 그리드 갱신
    }
  } catch (err) {
    // 다른 프로세스가 클립보드를 잠시 점유했으면 다음 변경 이벤트/안전망 폴링에서 재시도한다.
    console.warn('[copy-manager] 클립보드 읽기 실패(재시도 예정):', err)
  }
}

function startClipboardCapture(s: ClipboardStore): void {
  // WM_CLIPBOARDUPDATE가 즉시 캡처를 깨우고, 폴링은 감시 프로세스 실패/경쟁 상태의 안전망이다.
  clipboardWatcher = startWindowsClipboardWatcher({
    onChange: () => captureCurrentClipboard(s),
    onReady: () => console.info('[copy-manager] Windows 클립보드 변경 감시 시작'),
    onError: (err) => console.warn('[copy-manager] 변경 감시 실패 — 250ms 폴링 유지:', err)
  })
  pollTimer = setInterval(() => captureCurrentClipboard(s), POLL_INTERVAL_MS)
}

/** 연속 복사 중에는 메모리/UI를 즉시 갱신하고, 전체 파일 저장은 마지막 변경 뒤 한 번 수행한다. */
function scheduleHistorySave(s: ClipboardStore): void {
  if (historySaveTimer) clearTimeout(historySaveTimer)
  historySaveTimer = setTimeout(() => {
    historySaveTimer = null
    void s.save().catch((err: unknown) => {
      console.warn('[copy-manager] 클립보드 히스토리 저장 실패:', err)
    })
  }, HISTORY_SAVE_DEBOUNCE_MS)
}

/** 종료 직전 대기 중인 디바운스 저장까지 모두 디스크에 반영한다. */
async function flushHistorySave(s: ClipboardStore): Promise<void> {
  if (historySaveTimer) {
    clearTimeout(historySaveTimer)
    historySaveTimer = null
  }
  await s.save()
}

/** 중복 제거 직후 현재 OS 클립보드가 폴링으로 즉시 다시 적재되지 않도록 억제한다. */
function suppressCurrentClipboardCapture(): void {
  const image = electronReader.readImageDataUrl()
  if (image) {
    suppressedCapture = { type: 'image', content: image }
    return
  }
  const text = electronReader.readText()
  suppressedCapture = text.trim().length > 0 ? { type: classifyText(text), content: text } : null
}

/** id 항목을 OS 클립보드에 쓴다(텍스트/링크/코드=텍스트, 이미지=dataURL). */
function writeItemToClipboard(item: ClipItem): void {
  if (item.type === 'image') {
    clipboard.writeImage(nativeImage.createFromDataURL(item.content))
  } else {
    clipboard.writeText(item.content)
  }
}

/**
 * 앱에서 항목을 복사·붙여넣기 한 직후 히스토리를 정리한다(D34).
 * - 새 카드를 만들지 않고 그 항목을 맨 앞으로 승격해 중복 카드를 막는다.
 * - 방금 쓴 클립보드가 폴링에 다시 잡히지 않도록 캡처를 억제한다. 억제 키는 item 내용이
 *   아니라 *다시 읽은* 클립보드 값이어야 한다 — 이미지는 클립보드를 왕복하며 재인코딩돼
 *   dataURL 바이트가 달라질 수 있어 원본과 비교하면 억제가 빗나간다.
 */
async function promoteAfterCopy(s: ClipboardStore, id: string): Promise<void> {
  suppressCurrentClipboardCapture()
  if (!s.promote(id)) return
  await s.save()
  notifyRenderer()
}

function registerIpc(s: ClipboardStore): void {
  // 최소 IPC 표면만 노출(보안).
  ipcMain.handle('app:get-info', () => getAppInfo())
  ipcMain.handle('history:get', (): readonly ClipItem[] => s.getAll())

  // ✕ 버튼/명시적 닫기 — 창 숨김(D5 갱신: blur 자동숨김 대신 명시 닫기)
  ipcMain.on('window:hide', () => {
    hideWindow()
  })

  // 헤더 📌 — 항상 위(alwaysOnTop) 토글. 새 상태를 저장해 단축키 재호출·재시작 뒤에도 유지.
  ipcMain.handle('window:toggle-aot', async (): Promise<boolean> => {
    const alwaysOnTop = toggleAlwaysOnTop()
    if (!settings) return alwaysOnTop
    const next = settings.set({ alwaysOnTop })
    await settings.save()
    notifySettings(next)
    return alwaysOnTop
  })

  // 클릭=복사: 클립보드에 쓰기만(창 유지) — D12. 그 항목은 맨 앞으로 승격(D34)
  ipcMain.handle('clip:copy', async (_event, rawId: unknown): Promise<boolean> => {
    const item = s.getAll().find((i) => i.id === rawId)
    if (!item) return false
    writeItemToClipboard(item)
    await promoteAfterCopy(s, item.id)
    return true
  })

  // Enter/더블클릭=붙여넣기: 클립보드에 쓴 뒤 창 숨기고 직전 앱에 Ctrl+V 합성 — D12 / S3e
  ipcMain.handle('clip:paste', async (_event, rawId: unknown): Promise<boolean> => {
    const item = s.getAll().find((i) => i.id === rawId)
    if (!item) return false
    writeItemToClipboard(item)
    await promoteAfterCopy(s, item.id) // 붙여넣기도 재사용이므로 동일하게 승격(D34)
    getWindow()?.hide()
    await restoreLastActiveWindow() // 직전 앱 창에 포커스 복원(Windows 포그라운드 복귀)
    await delay(PASTE_FOCUS_DELAY_MS)
    await sendCtrlV()
    return true
  })

  // S5: 항목 핀 토글(카드 📌 / 우클릭 / 상세) — D7/D13. (창 유지 keepOpen 과는 별개)
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

  // 같은 타입·내용의 비핀 중복을 최신 1개만 남긴다. 핀 항목은 D7 규칙대로 보존.
  ipcMain.handle('clip:deduplicate', async (): Promise<number> => {
    const removed = s.removeDuplicates()
    if (removed === 0) return 0
    suppressCurrentClipboardCapture()
    await s.save()
    notifyRenderer()
    return removed
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

  // 새 키를 먼저 등록해 보고 성공한 경우에만 기존 키·저장값을 교체한다.
  ipcMain.handle(
    'hotkey:set',
    async (_event, raw: unknown): Promise<{ ok: boolean; settings: AppSettings }> => {
      const current = settings?.get() ?? DEFAULT_SETTINGS
      if (!settings || typeof raw !== 'string' || raw.length === 0) {
        return { ok: false, settings: current }
      }
      if (!replaceHotkey(current.hotkey, raw)) {
        return { ok: false, settings: current }
      }
      const next = settings.set({ hotkey: raw })
      await settings.save()
      notifySettings(next)
      return { ok: true, settings: next }
    }
  )

  ipcMain.handle('settings:set', async (_event, raw: unknown): Promise<AppSettings> => {
    if (!settings) return DEFAULT_SETTINGS
    const prev = settings.get()
    const { hotkey: _hotkey, ...patch } = (raw ?? {}) as Partial<AppSettings>
    const next = settings.set(patch)
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

async function initializeApp(): Promise<void> {
  const userData = app.getPath('userData')
  // D29: 저장 암호화(safeStorage/DPAPI). app ready 이후 cipher 생성 → store 에 주입.
  // 기존 평문 clip-history.json 은 load 시 그대로 읽히고, 다음 save 때 암호화로 마이그레이션.
  const cipher = createSafeStorageCipher()
  store = new ClipboardStore({ filePath: join(userData, HISTORY_FILE), cipher })
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
  setKeepOpen(cfg.keepOpen) // D5 갱신: 저장된 창 유지 설정 반영
  setAlwaysOnTop(cfg.alwaysOnTop) // 헤더 📌 상태를 단축키 재호출·앱 재시작 뒤에도 유지
  setUiScale(cfg.uiScale) // D32: 저장된 전체 UI 배율을 창 생성 시 주입
  setWindowPlacement(cfg.windowPlacement) // D32: 저장된 9분할 배치값을 창 생성 시 주입
  setWindowPosition(cfg.windowPosition) // D33: 헤더 드래그로 저장한 실제 좌표를 창 생성 시 복원
  setContentProtection(cfg.contentProtection) // D28: 창 생성 전 주입 → createWindow 에서 적용
  applyLaunchAtStartup(cfg.launchAtStartup) // D30: 저장된 자동 실행 설정을 OS 로그인 항목과 동기화
  await store.save()

  const win = createWindow()
  win.setTitle(getWindowTitle())
  loadRenderer(win)
  registerIpc(store)
  watchWindowPosition(win)

  if (!registerHotkey(cfg.hotkey)) {
    console.warn('[copy-manager] 전역 핫키 등록 실패(다른 앱이 선점했을 수 있음)')
  }
  startClipboardCapture(store)

  app.on('activate', () => {
    if (getWindow() === null) {
      const w = createWindow()
      loadRenderer(w)
      watchWindowPosition(w)
    }
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  void app.whenReady().then(initializeApp)
}

// 클립보드 매니저는 창을 닫아도 백그라운드 유지가 자연스럽지만,
// S1~S3 단계에서는 단순화: 모든 창이 닫히면 종료(트레이는 후속 슬라이스).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (!store || historyFlushedForQuit) return
  event.preventDefault()
  void flushHistorySave(store)
    .catch((err: unknown) => {
      console.warn('[copy-manager] 종료 전 클립보드 히스토리 저장 실패:', err)
    })
    .finally(() => {
      historyFlushedForQuit = true
      app.quit()
    })
})

app.on('will-quit', () => {
  if (windowPositionTimer) {
    clearTimeout(windowPositionTimer)
    windowPositionTimer = null
    void persistWindowPosition()
  }
  unregisterHotkey()
  clipboardWatcher?.stop()
  clipboardWatcher = null
  if (pollTimer) clearInterval(pollTimer)
  if (historySaveTimer) clearTimeout(historySaveTimer)
})
