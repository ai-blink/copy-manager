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

  [DllImport("user32.dll", SetLastError=true)]
  private static extern bool OpenClipboard(IntPtr hwnd);

  [DllImport("user32.dll", SetLastError=true)]
  private static extern bool CloseClipboard();

  [DllImport("user32.dll")]
  private static extern bool IsClipboardFormatAvailable(uint format);

  [DllImport("user32.dll", SetLastError=true)]
  private static extern IntPtr GetClipboardData(uint format);

  [DllImport("kernel32.dll", SetLastError=true)]
  private static extern IntPtr GlobalLock(IntPtr hMem);

  [DllImport("kernel32.dll", SetLastError=true)]
  private static extern bool GlobalUnlock(IntPtr hMem);

  private const uint CF_BITMAP = 2;
  private const uint CF_DIB = 8;
  private const uint CF_UNICODETEXT = 13;
  private const uint CF_DIBV5 = 17;

  // ⚠️ 여기서 WinForms Clipboard.GetText 로 되돌리지 말 것 (2026-10-29 오인 사례).
  // "스냅샷 테스트가 간헐 실패" 를 처음엔 테스트 타이밍(고정 sleep·READY 시점) 문제로 봤지만 실제 원인은 이 함수였다.
  // Clipboard.GetText 는 다른 프로세스가 클립보드를 쥐고 있으면 100ms 간격으로 재시도한다. 그래서 A 이벤트의 읽기가
  // 약 214ms 걸렸고, 그 사이(150ms 뒤) B 가 써져 A 이벤트가 B 를 읽었다(A 유실). READY 시점·테스트 대기시간은 정상이었다.
  // 직접 OpenClipboard 를 5ms 간격으로 짧게 재시도하면 읽기가 7~14ms 로 줄어든다.
  // 같은 증상이 다시 보이면 sleep 을 늘리기 전에 아래 DIAG 로그(read=ms, issue=)의 읽기 소요시간부터 확인한다.
  // issue 는 읽기 실패 사유다: lock-timeout(클립보드를 계속 쥐고 있음)·no-data(확인 직후 포맷이 사라짐).
  private static string ReadUnicodeText(out string issue) {
    issue = null;
    for (int attempt = 0; attempt < 20; attempt++) {
      if (OpenClipboard(IntPtr.Zero)) {
        try {
          IntPtr handle = GetClipboardData(CF_UNICODETEXT);
          if (handle == IntPtr.Zero) { issue = "no-data"; return null; }
          IntPtr pointer = GlobalLock(handle);
          if (pointer == IntPtr.Zero) { issue = "no-data"; return null; }
          try {
            return Marshal.PtrToStringUni(pointer);
          } finally {
            GlobalUnlock(handle);
          }
        } finally {
          CloseClipboard();
        }
      }
      System.Threading.Thread.Sleep(5);
    }
    issue = "lock-timeout";
    return null;
  }

  // 읽기가 이 시간(ms) 이상 걸리거나 예상 밖 사유로 payload 없이 CHANGED 만 보낼 때만 DIAG 줄을 낸다.
  // 이미지·비텍스트 클립보드의 CHANGED 는 정상 동작이라 기록하지 않는다(로그 소음 방지).
  private const long SLOW_READ_MS = 50;

  private static string SnapshotLine(out string diag) {
    diag = null;
    string issue = null;
    string line = "CHANGED";
    System.Diagnostics.Stopwatch timer = System.Diagnostics.Stopwatch.StartNew();
    try {
      if (!(IsClipboardFormatAvailable(CF_BITMAP) || IsClipboardFormatAvailable(CF_DIB) || IsClipboardFormatAvailable(CF_DIBV5) ||
            !IsClipboardFormatAvailable(CF_UNICODETEXT))) {
        string text = ReadUnicodeText(out issue);
        if (issue == null && text != null && text.Length > MAX_SNAPSHOT_CHARS) issue = "too-large";
        if (issue == null && !String.IsNullOrEmpty(text)) {
          line = "CHANGED " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text));
        }
      }
    } catch (Exception ex) {
      issue = "exception-" + ex.GetType().Name;
    }
    timer.Stop();
    if (issue != null || timer.ElapsedMilliseconds >= SLOW_READ_MS) {
      diag = "DIAG read=" + timer.ElapsedMilliseconds + "ms" + (issue != null ? " issue=" + issue : "");
    }
    return line;
  }

  protected override void WndProc(ref Message message) {
    if (message.Msg == WM_CLIPBOARDUPDATE) {
      string diag;
      string line = SnapshotLine(out diag);
      if (diag != null) Console.WriteLine(diag);
      Console.WriteLine(line);
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

/**
 * 감시 프로세스의 한 줄을 해석한다. CHANGED[ <base64 utf8 텍스트>] → 변경 신호와 선택적 텍스트 스냅샷.
 * DIAG <진단 문구> → 스냅샷 읽기가 느리거나(read=ms) 실패했을 때(issue=사유) 직전 CHANGED 보다 먼저 온다.
 */
export function parseWatcherLine(
  line: string
): { kind: 'ready' } | { kind: 'changed'; text?: string } | { kind: 'diag'; message: string } | null {
  if (line === 'READY') return { kind: 'ready' }
  if (line.startsWith('DIAG ')) return { kind: 'diag', message: line.slice('DIAG '.length) }
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
  /** 스냅샷 읽기가 느리거나 실패했을 때의 진단 문구(예: `read=214ms issue=lock-timeout`). */
  onDiagnostic?(message: string): void
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
      } else if (parsed?.kind === 'diag') {
        callbacks.onDiagnostic?.(parsed.message)
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
