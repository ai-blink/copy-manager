import { spawn, type ChildProcess } from 'node:child_process'

const READY_TIMEOUT_MS = 8_000

// Electron은 Windows 클립보드 변경 이벤트를 직접 노출하지 않는다.
// 별도 의존성/네이티브 애드온 없이 WM_CLIPBOARDUPDATE만 전달받도록,
// Windows PowerShell의 숨은 WinForms 메시지 창을 사용한다. 내용은 읽지 않고 신호만 stdout으로 보낸다.
const WATCHER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public sealed class CopyManagerClipboardWatcher : Form {
  private const int WM_CLIPBOARDUPDATE = 0x031D;

  [DllImport("user32.dll", SetLastError=true)]
  private static extern bool AddClipboardFormatListener(IntPtr hwnd);

  [DllImport("user32.dll", SetLastError=true)]
  private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

  [DllImport("user32.dll")]
  private static extern bool PostMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam);

  public bool IsListening { get; private set; }

  public CopyManagerClipboardWatcher() {
    ShowInTaskbar = false;
    WindowState = FormWindowState.Minimized;
  }

  protected override void SetVisibleCore(bool value) {
    base.SetVisibleCore(false);
  }

  protected override void OnHandleCreated(EventArgs e) {
    base.OnHandleCreated(e);
    if (!AddClipboardFormatListener(Handle)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    IsListening = true;
    Console.WriteLine("READY");
    Console.Out.Flush();
    // 메시지 루프와 stdout 전달 경로를 시작 즉시 자체 검증하고 현재 클립보드도 한 번 캡처한다.
    PostMessage(Handle, WM_CLIPBOARDUPDATE, IntPtr.Zero, IntPtr.Zero);
  }

  protected override void OnHandleDestroyed(EventArgs e) {
    if (IsListening) RemoveClipboardFormatListener(Handle);
    IsListening = false;
    base.OnHandleDestroyed(e);
  }

  // 변경 시점의 텍스트를 함께 보낸다(D43). 신호만 보내면 main 이 읽기 전에 다음 복사가 덮어써 중간 항목이 사라진다.
  // 이미지가 함께 있거나 읽기 실패·초대형이면 payload 없이 CHANGED 만 보내 main 이 기존처럼 읽는다.
  private const int MAX_SNAPSHOT_CHARS = 1000000;

  private static string SnapshotLine() {
    try {
      if (Clipboard.ContainsImage() || !Clipboard.ContainsText(TextDataFormat.UnicodeText)) return "CHANGED";
      string text = Clipboard.GetText(TextDataFormat.UnicodeText);
      if (String.IsNullOrEmpty(text) || text.Length > MAX_SNAPSHOT_CHARS) return "CHANGED";
      return "CHANGED " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text));
    } catch {
      return "CHANGED";
    }
  }

  protected override void WndProc(ref Message message) {
    if (message.Msg == WM_CLIPBOARDUPDATE) {
      Console.WriteLine(SnapshotLine());
      Console.Out.Flush();
    }
    base.WndProc(ref message);
  }
}
"@ -ReferencedAssemblies 'System.Windows.Forms.dll','System.Drawing.dll'

$watcher = New-Object CopyManagerClipboardWatcher
[void]$watcher.Handle
[System.Windows.Forms.Application]::Run()
`

export interface ClipboardWatcherHandle {
  stop(): void
}

/** 감시 프로세스의 한 줄을 해석한다. CHANGED[ <base64 utf8 텍스트>] → 변경 신호와 선택적 텍스트 스냅샷. */
export function parseWatcherLine(
  line: string
): { kind: 'ready' } | { kind: 'changed'; text?: string } | null {
  if (line === 'READY') return { kind: 'ready' }
  if (line === 'CHANGED') return { kind: 'changed' }
  if (line.startsWith('CHANGED ')) {
    const payload = line.slice('CHANGED '.length)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return { kind: 'changed' }
    return { kind: 'changed', text: Buffer.from(payload, 'base64').toString('utf8') }
  }
  return null
}

export interface ClipboardWatcherCallbacks {
  /** snapshotText 가 있으면 변경 시점의 텍스트다(이미지 없음). 없으면 호출자가 현재 클립보드를 읽는다. */
  onChange(snapshotText?: string): void
  onReady?(): void
  onError?(error: Error): void
}

/** Windows WM_CLIPBOARDUPDATE를 main 프로세스 콜백으로 전달한다. */
export function startWindowsClipboardWatcher(
  callbacks: ClipboardWatcherCallbacks
): ClipboardWatcherHandle {
  const encodedScript = Buffer.from(WATCHER_SCRIPT, 'utf16le').toString('base64')
  let child: ChildProcess | null = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-WindowStyle',
      'Hidden',
      '-EncodedCommand',
      encodedScript
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let stopped = false
  let errorReported = false
  let stdoutBuffer = ''
  let stderrBuffer = ''

  const reportError = (error: Error): void => {
    if (stopped || errorReported) return
    errorReported = true
    callbacks.onError?.(error)
  }

  const readyTimer = setTimeout(() => {
    reportError(new Error('Windows 클립보드 변경 감시 준비 시간 초과'))
  }, READY_TIMEOUT_MS)

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    stdoutBuffer += chunk
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ''
    for (const rawLine of lines) {
      const parsed = parseWatcherLine(rawLine.trim())
      if (parsed?.kind === 'ready') {
        clearTimeout(readyTimer)
        callbacks.onReady?.()
      } else if (parsed?.kind === 'changed') {
        callbacks.onChange(parsed.text)
      }
    }
  })

  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderrBuffer = `${stderrBuffer}${chunk}`.slice(-1_000)
  })

  child.once('error', (error) => reportError(error))
  child.once('exit', (code, signal) => {
    clearTimeout(readyTimer)
    if (!stopped) {
      const detail = stderrBuffer.trim()
      reportError(
        new Error(
          `Windows 클립보드 변경 감시 종료(code=${String(code)}, signal=${String(signal)})${
            detail ? `: ${detail}` : ''
          }`
        )
      )
    }
    child = null
  })

  return {
    stop(): void {
      if (stopped) return
      stopped = true
      clearTimeout(readyTimer)
      child?.kill()
      child = null
    }
  }
}
