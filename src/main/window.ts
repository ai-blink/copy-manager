import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getActiveWindow } from '@nut-tree-fork/nut-js'

// S1: frameless + alwaysOnTop + transparent 창, blur→hide(핀이면 유지, D5).

type NutWindow = Awaited<ReturnType<typeof getActiveWindow>>

let win: BrowserWindow | null = null
let pinned = false
// S3e: 창을 열기 직전의 활성 윈도우(직전 앱) — 붙여넣기 시 포커스 복원 대상.
let lastActiveWindow: NutWindow | null = null

/** 창 생성. 핀 off 상태에서 포커스를 잃으면(blur) 자동 숨김. */
export function createWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 760,
    height: 560,
    frame: false, // frameless
    alwaysOnTop: true, // alwaysOnTop
    transparent: true, // transparent
    show: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true, // 보안 기본값
      nodeIntegration: false, // 보안 기본값
      sandbox: true
    }
  })

  // D5: 자동숨김(blur→hide). 핀이면 유지.
  win.on('blur', () => {
    if (!pinned) win?.hide()
  })

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

export function setPinned(value: boolean): void {
  pinned = value
}

export function isPinned(): boolean {
  return pinned
}

export function getWindow(): BrowserWindow | null {
  return win
}
