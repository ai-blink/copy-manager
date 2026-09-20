import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { getActiveWindow } from '@nut-tree-fork/nut-js'
import type { WindowPlacement, WindowPosition } from '../shared/settings'

// frameless + alwaysOnTop + transparent 창. D5(갱신): 기본 "창 유지"(blur 무시).
// keepOpen=false 일 때만 blur→hide(자동숨김). 명시적 닫기는 ✕ 버튼만 담당한다.

type NutWindow = Awaited<ReturnType<typeof getActiveWindow>>

let win: BrowserWindow | null = null
// Alt+F4 같은 일반 창 닫기는 숨김으로 처리한다. 설정의 "앱 종료" 요청 때만 true로 전환한다.
let allowWindowCloseForQuit = false
// 창 유지 여부(설정 keepOpen, 기본 true). 시작 시 settings 에서 주입.
let keepOpen = true
// 항상 위(alwaysOnTop) 토글 상태(기본 true). 시작 시 저장된 설정을 주입한다.
let alwaysOnTop = true
// 전체 UI 배율(설정 uiScale, 기본 100%). 창 외곽 크기는 유지하고 렌더러만 확대/축소한다.
let uiScale = 1
// 창 배치(설정 windowPlacement, 기본 중앙). 실제 좌표는 현재 창이 있는 디스플레이 기준으로 계산한다.
let windowPlacement: WindowPlacement = 'center'
// 헤더 드래그 뒤 저장한 실제 창 좌표. 없으면 9분할 배치값을 사용한다.
let windowPosition: WindowPosition | null = null
// 화면 캡처 방지(content protection, D28). 기본 true(보안 우선). 시작 시 settings 에서 주입.
// Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE, Win10 2004+) → 캡처에서 제외.
// 구버전은 WDA_MONITOR(검은색) 폴백. RDP 등 일부 원격 경로는 효과가 다를 수 있음.
let contentProtection = true
// S3e: 창을 열기 직전의 활성 윈도우(직전 앱) — 붙여넣기 시 포커스 복원 대상.
let lastActiveWindow: NutWindow | null = null

/** 창 생성. 핀 off 상태에서 포커스를 잃으면(blur) 자동 숨김. */
export function createWindow(): BrowserWindow {
  allowWindowCloseForQuit = false
  win = new BrowserWindow({
    width: 760,
    height: 560,
    frame: false, // frameless
    alwaysOnTop,
    transparent: true, // transparent
    show: false,
    resizable: true,
    // 작업표시줄 + Alt+Tab 에 표시(key-demo-osk FocusProtection 패턴 이식).
    // skipTaskbar:true 는 WS_EX_TOOLWINDOW 를 붙여 작업표시줄·Alt+Tab 에서 제외함 → false 로 고정.
    // (OSK 의 WS_EX_NOACTIVATE 는 이식 안 함: copy-manager 는 열릴 때 포커스를 받아야 함)
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true, // 보안 기본값
      nodeIntegration: false, // 보안 기본값
      sandbox: true
    }
  })

  // D5(갱신): keepOpen=false 일 때만 자동숨김(blur→hide). 기본(keepOpen=true)은 유지.
  win.on('blur', () => {
    if (!keepOpen) win?.hide()
  })

  // 프레임리스 앱에서 Alt+F4는 BrowserWindow의 close 이벤트로 들어온다.
  // 실수로 감시 프로세스까지 종료하지 않도록 숨기고, 명시적 종료만 통과시킨다.
  win.on('close', (event) => {
    if (allowWindowCloseForQuit) return
    event.preventDefault()
    win?.hide()
  })

  // 창만 활성화하는 것과 렌더러의 검색 입력에 포커스를 주는 것은 별개다.
  // 렌더러가 모달·메뉴 상태를 보고 안전할 때만 검색창으로 포커스를 되돌린다.
  win.on('focus', () => {
    win?.webContents.send('window:focused')
  })

  // D28: 화면 캡처 방지 적용(스크린샷/녹화/화면공유에서 창 제외). 시작 시 주입된 값 반영.
  win.setContentProtection(contentProtection)
  win.webContents.setZoomFactor(uiScale)
  if (windowPosition) {
    applyWindowPosition()
  } else {
    applyWindowPlacement()
  }

  return win
}

/** 전역 핫키 콜백: 창을 복원·표시하고 포커스를 준다.
 * 다른 앱이 활성 상태일 때만 그 창을 기록해 붙여넣기 포커스 복원에 사용한다. */
export async function activateWindow(): Promise<void> {
  if (!win) return

  if (!win.isFocused()) {
    try {
      lastActiveWindow = await getActiveWindow()
    } catch {
      lastActiveWindow = null
    }
  }

  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/** S3e: 붙여넣기 직전, 기억해 둔 직전 앱 창에 포커스를 되돌린다(Ctrl+V 대상 확보). */
export async function restoreLastActiveWindow(): Promise<boolean> {
  if (!lastActiveWindow) return false
  try {
    return await lastActiveWindow.focus()
  } catch {
    return false
  }
}

/** 창 유지 여부 설정(설정 keepOpen). false 면 blur 시 자동숨김. */
export function setKeepOpen(value: boolean): void {
  keepOpen = value
}

export function isKeepOpen(): boolean {
  return keepOpen
}

/** ✕ 버튼/명시적 닫기 — 창 숨김. */
export function hideWindow(): void {
  win?.hide()
}

/** 설정의 "앱 종료"처럼 사용자 의도가 명확한 종료만 창 close를 통과시킨다. */
export function permitWindowCloseForQuit(): void {
  allowWindowCloseForQuit = true
}

/** 헤더 📌 — 항상 위(alwaysOnTop) 토글. 새 상태 반환. */
export function toggleAlwaysOnTop(): boolean {
  alwaysOnTop = !alwaysOnTop
  win?.setAlwaysOnTop(alwaysOnTop)
  return alwaysOnTop
}

export function isAlwaysOnTop(): boolean {
  return alwaysOnTop
}

/** 저장된 항상 위 설정을 적용한다. 창 생성 전이면 다음 창 생성 시 반영된다. */
export function setAlwaysOnTop(value: boolean): void {
  alwaysOnTop = value
  win?.setAlwaysOnTop(value)
}

/** 전체 UI 배율을 적용한다. 설정 UI의 범위(75~150%) 밖 값은 무시한다. */
export function setUiScale(value: number): void {
  if (!Number.isFinite(value) || value < 0.75 || value > 1.5) return
  uiScale = value
  win?.webContents.setZoomFactor(value)
}

/** 9분할 배치값을 보관하고, 열린 창이면 현재 디스플레이에서 즉시 이동한다. */
export function setWindowPlacement(value: WindowPlacement): void {
  windowPlacement = value
  windowPosition = null
  applyWindowPlacement()
}

/** 저장된 실제 창 좌표를 보관하고, 창이 열려 있으면 현재 모니터 작업 영역 안으로 보정해 적용한다. */
export function setWindowPosition(value: WindowPosition | null): void {
  windowPosition = value ? { ...value } : null
  if (windowPosition) applyWindowPosition()
}

/** 현재 창의 실제 좌표를 불변 복사본으로 반환한다. */
export function getWindowPosition(): WindowPosition | null {
  if (!win) return null
  const [x, y] = win.getPosition()
  return { x, y }
}

/** 저장 위치가 디스플레이 구성 변경 뒤에도 화면 밖으로 나가지 않도록 가장 가까운 작업 영역 안으로 보정한다. */
function applyWindowPosition(): void {
  if (!win || !windowPosition) return

  const display = screen.getDisplayNearestPoint(windowPosition)
  const { x, y, width, height } = display.workArea
  const [windowWidth, windowHeight] = win.getSize()
  const maxX = Math.max(x, x + width - windowWidth)
  const maxY = Math.max(y, y + height - windowHeight)
  const targetX = Math.min(Math.max(windowPosition.x, x), maxX)
  const targetY = Math.min(Math.max(windowPosition.y, y), maxY)
  const [currentX, currentY] = win.getPosition()
  if (currentX !== Math.round(targetX) || currentY !== Math.round(targetY)) {
    win.setPosition(Math.round(targetX), Math.round(targetY))
  }
}

/** 작업표시줄을 제외한 현재 디스플레이의 작업 영역 안에서 창을 9분할 위치로 이동한다. */
function applyWindowPlacement(): void {
  if (!win) return

  const display = screen.getDisplayMatching(win.getBounds())
  const { x, y, width, height } = display.workArea
  const [windowWidth, windowHeight] = win.getSize()
  const maxX = Math.max(x, x + width - windowWidth)
  const maxY = Math.max(y, y + height - windowHeight)
  const centerX = x + (width - windowWidth) / 2
  const centerY = y + (height - windowHeight) / 2

  const isLeft =
    windowPlacement === 'top-left' ||
    windowPlacement === 'left' ||
    windowPlacement === 'bottom-left'
  const isRight =
    windowPlacement === 'top-right' ||
    windowPlacement === 'right' ||
    windowPlacement === 'bottom-right'
  const isTop =
    windowPlacement === 'top-left' || windowPlacement === 'top' || windowPlacement === 'top-right'
  const isBottom =
    windowPlacement === 'bottom-left' ||
    windowPlacement === 'bottom' ||
    windowPlacement === 'bottom-right'

  const targetX = isLeft ? x : isRight ? maxX : centerX
  const targetY = isTop ? y : isBottom ? maxY : centerY
  win.setPosition(Math.round(targetX), Math.round(targetY))
}

/** 화면 캡처 방지 토글(설정 contentProtection, D28). true 면 스크린샷/녹화/화면공유에서 창 제외.
 * 시작 시(창 생성 전) 호출되면 값만 저장되고 createWindow 에서 실제 적용된다. */
export function setContentProtection(value: boolean): void {
  contentProtection = value
  win?.setContentProtection(value)
}

export function isContentProtection(): boolean {
  return contentProtection
}

export function getWindow(): BrowserWindow | null {
  return win
}
