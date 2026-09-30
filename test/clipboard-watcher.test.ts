import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { parseWatcherLine, startWindowsClipboardWatcher } from '../src/main/clipboard-watcher'

const windowsIt = process.platform === 'win32' ? it : it.skip

describe('감시 프로세스 출력 해석(D43)', () => {
  it('READY·CHANGED·스냅샷 payload 를 구분한다', () => {
    expect(parseWatcherLine('READY')).toEqual({ kind: 'ready' })
    expect(parseWatcherLine('CHANGED')).toEqual({ kind: 'changed' })
    const b64 = Buffer.from('안녕 A\n둘째줄', 'utf8').toString('base64')
    expect(parseWatcherLine(`CHANGED ${b64}`)).toEqual({ kind: 'changed', text: '안녕 A\n둘째줄' })
  })

  it('깨진 payload 는 신호만 전달하고 알 수 없는 줄은 무시한다', () => {
    expect(parseWatcherLine('CHANGED !!not-base64!!')).toEqual({ kind: 'changed' })
    expect(parseWatcherLine('noise')).toBeNull()
  })
})

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

  windowsIt('변경 시점의 텍스트를 스냅샷으로 전달한다(직후 덮어써도 보존)', async () => {
    const ps = (script: string): string =>
      execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
        encoding: 'utf8'
      })
    const previous = ps('Get-Clipboard -Raw')
    const marker = `snapshot-${Date.now()}`
    const seen: string[] = []
    let markReady: () => void = () => undefined
    const ready = new Promise<void>((resolve) => (markReady = resolve))
    const watcher = startWindowsClipboardWatcher({
      onChange: (text) => {
        if (text !== undefined) seen.push(text)
      },
      onReady: markReady,
      onError: () => undefined
    })
    try {
      await ready
      // 짧은 간격으로 A→B 연속 복사. 각 변경 시점의 텍스트가 스냅샷으로 따로 전달돼야 한다.
      // (감시 프로세스 자신의 메시지 처리보다 빠른 덮어쓰기는 원리상 못 잡는다 — 간격을 그 아래로 줄이지 않는다.)
      ps(`Set-Clipboard -Value '${marker}-A'; Start-Sleep -Milliseconds 150; Set-Clipboard -Value '${marker}-B'`)
      await new Promise((r) => setTimeout(r, 1_500))
      expect(seen).toContain(`${marker}-A`)
      expect(seen).toContain(`${marker}-B`)
    } finally {
      watcher.stop()
      ps(`Set-Clipboard -Value '${previous.replace(/'/g, "''").trimEnd()}'`)
    }
  }, 20_000)
})
