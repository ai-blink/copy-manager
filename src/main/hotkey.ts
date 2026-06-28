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
