import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getActiveWindow } from '@nut-tree-fork/nut-js'

// frameless + alwaysOnTop + transparent 창. D5(갱신): 기본 "창 유지"(blur 무시).
// keepOpen=false 일 때만 blur→hide(자동숨김). 닫기=핫키 재누름 또는 ✕ 버튼.

type NutWindow = Awaited<ReturnType<typeof getActiveWindow>>

let win: BrowserWindow | null = null
// 창 유지 여부(설정 keepOpen, 기본 true). 시작 시 settings 에서 주입.
let keepOpen = true
// 항상 위(alwaysOnTop) 토글 상태(기본 true). 시작 시 저장된 설정을 주입한다.
let alwaysOnTop = true
// 화면 캡처 방지(content protection, D28). 기본 true(보안 우선). 시작 시 settings 에서 주입.
// Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE, Win10 2004+) → 캡처에서 제외.
// 구버전은 WDA_MONITOR(검은색) 폴백. RDP 등 일부 원격 경로는 효과가 다를 수 있음.
let contentProtection = true
// S3e: 창을 열기 직전의 활성 윈도우(직전 앱) — 붙여넣기 시 포커스 복원 대상.
let lastActiveWindow: NutWindow | null = null

/** 창 생성. 핀 off 상태에서 포커스를 잃으면(blur) 자동 숨김. */
export function createWindow(): BrowserWindow {
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

  // D28: 화면 캡처 방지 적용(스크린샷/녹화/화면공유에서 창 제외). 시작 시 주입된 값 반영.
  win.setContentProtection(contentProtection)

  return win
}

/** 전역 핫키 콜백: 보이면 숨기고, 숨겨져 있으면 띄워서 포커스.
 * 띄우기 직전 활성 윈도우(직전 앱)를 기록해 붙여넣기 포커스 복원에 사용. */
export async function toggleWindow(): Promise<void> {
  if (!win) return
  if (win.isVisible()) {
    win.hide()
  } else {
    try {
      lastActiveWindow = await getActiveWindow()
    } catch {
      lastActiveWindow = null
    }
    win.show()
    win.focus()
  }
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
