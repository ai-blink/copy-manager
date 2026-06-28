import { globalShortcut } from 'electron'
import { toggleWindow } from './window'

// S1: 전역 핫키 기본값 Ctrl+Shift+V (D11 / goal Constraints).
// CommandOrControl 은 Windows 에서 Ctrl 로 매핑된다. win+v 가로채기는 하지 않음(OS 기록과 공존).
export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+V'

/** 핫키 등록. 등록 성공 여부 반환(다른 앱이 선점했으면 false). */
export function registerHotkey(accelerator: string = DEFAULT_HOTKEY): boolean {
  return globalShortcut.register(accelerator, () => {
    void toggleWindow()
  })
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll()
}

/** 핫키 재등록(설정 변경 시). 기존 등록 해제 후 새 accelerator 로 등록. */
export function reRegisterHotkey(accelerator: string): boolean {
  unregisterHotkey()
  return registerHotkey(accelerator)
}
