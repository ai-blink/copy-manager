import { describe, expect, it } from 'vitest'
import { startWindowsClipboardWatcher } from '../src/main/clipboard-watcher'

const windowsIt = process.platform === 'win32' ? it : it.skip

describe('Windows 클립보드 변경 감시', () => {
  windowsIt('숨은 WM_CLIPBOARDUPDATE 감시 창을 준비한다', async () => {
    let markReady: () => void = () => undefined
    let markChanged: () => void = () => undefined
    let markFailed: (error: Error) => void = () => undefined
    const readyAndChanged = new Promise<void>((resolve, reject) => {
      let ready = false
      let changed = false
      const finish = (): void => {
        if (ready && changed) resolve()
      }
      markReady = () => {
        ready = true
        finish()
      }
      markChanged = () => {
        changed = true
        finish()
      }
      markFailed = reject
    })
    const watcher = startWindowsClipboardWatcher({
      onChange: markChanged,
      onReady: markReady,
      onError: markFailed
    })
    try {
      await readyAndChanged
      expect(watcher).toBeDefined()
    } finally {
      watcher.stop()
    }
  }, 12_000)
})
