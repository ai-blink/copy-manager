// S4 — 창 내부 플로팅 스크롤 리모컨 (독립 컴포넌트).
// dev-arch / D8~D10 / D18: scroll-remote 는 clipboard 도메인에 비의존하는 느슨 결합 컴포넌트.
//   입력 = 스크롤 대상(target) + 플로팅/드래그 경계(container)
//   출력 = target.scrollTop 조작
// → 전역(시스템 전체) 스크롤 리모컨으로 떼어낼 때 이 파일만 분리하면 되도록 의존성을 격리.

export type RemoteMode = 'dwell' | 'click'

export interface ScrollRemoteOptions {
  /** 스크롤시킬 대상(overflow 스크롤 컨테이너) */
  target: HTMLElement
  /** 리모컨이 떠 있고 드래그로 이동 가능한 경계(position:relative 권장) */
  container: HTMLElement
  /** D9: 드웰(호버 게이지) 또는 클릭/홀드. 기본 dwell */
  mode?: RemoteMode
  /** 드웰 임계 시간(ms). 기본 700 */
  dwellMs?: number
  /** 프레임당 스크롤 px(속도). 기본 6 */
  speed?: number
  /** D10: 평소 투명도 0~1(호버 시 1로 또렷). 기본 0.65 */
  opacity?: number
  /** ⚙ 클릭 콜백 — 설정 모달은 S5에서 연결 */
  onSettings?: () => void
}

export interface ScrollRemoteHandle {
  /** 생성된 리모컨 DOM 루트 */
  readonly el: HTMLDivElement
  setMode(mode: RemoteMode): void
  setDwellMs(ms: number): void
  setSpeed(px: number): void
  setOpacity(op: number): void
  /** 리모컨 표시/숨김. 숨길 때 진행 중인 드웰·스크롤을 즉시 정지 (D31) */
  setVisible(on: boolean): void
  destroy(): void
}

const DEFAULT_MODE: RemoteMode = 'dwell'
const DEFAULT_DWELL_MS = 700
const DEFAULT_SPEED = 6
const DEFAULT_OPACITY = 0.65

export function mountScrollRemote(opts: ScrollRemoteOptions): ScrollRemoteHandle {
  const { target, container } = opts
  let mode: RemoteMode = opts.mode ?? DEFAULT_MODE
  let dwellMs = opts.dwellMs ?? DEFAULT_DWELL_MS
  let speed = opts.speed ?? DEFAULT_SPEED

  const stoppers: Array<() => void> = []

  const remote = document.createElement('div')
  remote.className = 'remote'
  remote.style.right = '14px'
  remote.style.bottom = '14px'
  remote.style.setProperty('--remote-op', String(opts.opacity ?? DEFAULT_OPACITY))

  const grip = document.createElement('div')
  grip.className = 'grip'
  grip.textContent = '⋮⋮'
  grip.title = '드래그로 이동'

  const upBtn = makeButton(-1, '▲')
  const downBtn = makeButton(1, '▼')

  const setBtn = document.createElement('div')
  setBtn.className = 'r-set'
  setBtn.textContent = '⚙'
  setBtn.title = '리모컨 설정'
  setBtn.addEventListener('click', () => opts.onSettings?.())

  const modeLabel = document.createElement('div')
  modeLabel.className = 'r-mode'
  modeLabel.textContent = labelFor(mode)

  remote.append(grip, upBtn, downBtn, setBtn, modeLabel)
  container.appendChild(remote)

  // ── 버튼: 드웰 게이지 + 클릭/홀드 스크롤 ──────────────────────────
  function makeButton(dir: -1 | 1, glyph: string): HTMLDivElement {
    const btn = document.createElement('div')
    btn.className = 'r-btn'
    const g = document.createElement('span')
    g.className = 'glyph'
    g.textContent = glyph
    const gauge = document.createElement('span')
    gauge.className = 'gauge'
    btn.append(g, gauge)

    let rafGauge = 0
    let rafScroll = 0
    let startTs = -1

    const beginScroll = (): void => {
      btn.classList.add('active')
      const step = (): void => {
        target.scrollTop += dir * speed
        rafScroll = requestAnimationFrame(step)
      }
      rafScroll = requestAnimationFrame(step)
    }

    const stop = (): void => {
      btn.classList.remove('active')
      gauge.style.height = '0'
      if (rafGauge) cancelAnimationFrame(rafGauge)
      if (rafScroll) cancelAnimationFrame(rafScroll)
      rafGauge = 0
      rafScroll = 0
      startTs = -1
    }
    stoppers.push(stop)

    // D9: 호버 유지 → 아래서 위로 차오르는 게이지 → 임계시간 후 스크롤
    const tick = (ts: number): void => {
      if (startTs < 0) startTs = ts
      const p = Math.min((ts - startTs) / dwellMs, 1)
      gauge.style.height = `${p * 100}%`
      if (p >= 1) {
        beginScroll()
        return
      }
      rafGauge = requestAnimationFrame(tick)
    }

    btn.addEventListener('pointerenter', () => {
      if (mode === 'dwell') rafGauge = requestAnimationFrame(tick)
    })
    btn.addEventListener('pointerleave', stop)
    btn.addEventListener('pointerdown', () => {
      if (mode === 'click') beginScroll()
    })
    btn.addEventListener('pointerup', () => {
      if (mode === 'click') stop()
    })

    return btn
  }

  // ── 드래그(grip): 창 영역(container) 내 자유 이동, 경계 클램프 ──────
  let drag: { dx: number; dy: number; bounds: DOMRect } | null = null
  grip.addEventListener('pointerdown', (e: PointerEvent) => {
    const r = remote.getBoundingClientRect()
    const s = container.getBoundingClientRect()
    // right/bottom 기준 → left/top 기준으로 전환(이후 드래그 좌표 계산 일관성)
    remote.style.right = 'auto'
    remote.style.bottom = 'auto'
    remote.style.left = `${r.left - s.left}px`
    remote.style.top = `${r.top - s.top}px`
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, bounds: s }
    remote.classList.add('dragging')
    grip.setPointerCapture(e.pointerId)
  })
  grip.addEventListener('pointermove', (e: PointerEvent) => {
    if (!drag) return
    let x = e.clientX - drag.bounds.left - drag.dx
    let y = e.clientY - drag.bounds.top - drag.dy
    x = Math.max(0, Math.min(x, drag.bounds.width - remote.offsetWidth))
    y = Math.max(0, Math.min(y, drag.bounds.height - remote.offsetHeight))
    remote.style.left = `${x}px`
    remote.style.top = `${y}px`
  })
  grip.addEventListener('pointerup', () => {
    drag = null
    remote.classList.remove('dragging')
  })

  function labelFor(m: RemoteMode): string {
    return m === 'dwell' ? '드웰' : '클릭'
  }

  return {
    el: remote,
    setMode(m: RemoteMode): void {
      mode = m
      modeLabel.textContent = labelFor(m)
    },
    setDwellMs(ms: number): void {
      dwellMs = ms
    },
    setSpeed(px: number): void {
      speed = px
    },
    setOpacity(op: number): void {
      remote.style.setProperty('--remote-op', String(op))
    },
    setVisible(on: boolean): void {
      if (!on) stoppers.forEach((fn) => fn())
      remote.style.display = on ? '' : 'none'
    },
    destroy(): void {
      stoppers.forEach((fn) => fn())
      remote.remove()
    }
  }
}
