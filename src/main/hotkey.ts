import { globalShortcut } from 'electron'
import { activateWindow } from './window'

// 전역 핫키 기본값 Ctrl+Alt+V (D22 갱신).
// Ctrl+Shift+V 는 터미널 붙여넣기와 충돌(globalShortcut 은 전역 독점이라 가로챔) → Ctrl+Alt+V 로 변경.
// CommandOrControl 은 Windows 에서 Ctrl 로 매핑. win+v 가로채기는 안 함(OS 기록과 공존).
export const DEFAULT_HOTKEY = 'CommandOrControl+Alt+V'

/** 핫키 등록. 등록 성공 여부 반환(다른 앱이 선점했으면 false). */
export function registerHotkey(accelerator: string = DEFAULT_HOTKEY): boolean {
  return globalShortcut.register(accelerator, () => {
    void activateWindow()
  })
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll()
}

/**
 * 새 핫키가 실제로 등록될 때만 이전 핫키를 해제한다.
 * 다른 앱이 선점한 경우 false 를 반환하며, 기존 등록은 그대로 유지한다.
 */
export function replaceHotkey(previous: string, next: string): boolean {
  if (previous === next) return true
  if (!registerHotkey(next)) return false
  globalShortcut.unregister(previous)
  return true
}
