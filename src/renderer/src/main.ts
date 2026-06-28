import type { ClipItem, ClipType } from '../../shared/clipboard-store'

// S3 카드 그리드 렌더러(vanilla TS). mockup v4 로직을 타입 안전하게 포팅.
// 범위: 그리드 렌더 · 타입 탭 · 검색 필터 · 키보드 탐색(안 닫힘) · 클릭=복사 · Enter/더블클릭=붙여넣기.
// (카드 액션 📌⋯🗑️·상세/삭제 모달·설정·리모컨은 S4/S5 범위 — 만들지 않음)

const TYPE_LABEL: Record<ClipType, string> = {
  text: '텍스트',
  image: '이미지',
  link: '링크',
  code: '코드'
}

const COLS = 3 // D4: 한 줄 3개 기본(2~5 설정은 S5 설정 모달)

let items: ClipItem[] = [] // 최신이 앞(store 는 [old...new] 라 reverse)
let tab = '전체'
let filter = ''
let sel = 0

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`element #${id} not found`)
  return el as T
}

const listEl = $<HTMLDivElement>('list')
const emptyEl = $<HTMLDivElement>('empty')
const emptyMsgEl = $<HTMLDivElement>('emptyMsg')
const countHintEl = $<HTMLSpanElement>('countHint')
const searchEl = $<HTMLInputElement>('search')
const stateEl = $<HTMLSpanElement>('state')

function visible(): ClipItem[] {
  const f = filter.toLowerCase()
  return items.filter(
    (it) => (tab === '전체' || TYPE_LABEL[it.type] === tab) && it.content.toLowerCase().includes(f)
  )
}

function updateRowH(): void {
  const padX = 16
  const gap = 10
  const cw = listEl.clientWidth - padX
  const cardW = (cw - gap * (COLS - 1)) / COLS
  // D4: 카드 4:3 균일 → 행 높이를 카드폭×3/4 로 JS 고정(겹침 방지)
  document.documentElement.style.setProperty('--rowh', `${Math.max(96, (cardW * 3) / 4)}px`)
}

function selectAt(i: number): void {
  ;[...listEl.children].forEach((c, j) => c.classList.toggle('sel', j === i))
  const node = listEl.children[i]
  if (node) node.scrollIntoView({ block: 'nearest' })
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

async function doCopy(item: ClipItem, cardEl: HTMLElement): Promise<void> {
  const ok = await window.copyManager.copy(item.id)
  if (!ok) return
  cardEl.classList.add('flash')
  setTimeout(() => cardEl.classList.remove('flash'), 650)
}

async function doPaste(item: ClipItem): Promise<void> {
  await window.copyManager.paste(item.id)
}

function buildCard(it: ClipItem, index: number): HTMLDivElement {
  const card = document.createElement('div')
  const isImg = it.type === 'image'
  card.className = `card${index === sel ? ' sel' : ''}${isImg ? ' img' : ''}${
    it.type === 'code' ? ' code' : ''
  }`

  const meta = document.createElement('div')
  meta.className = 'meta'
  const typeSpan = document.createElement('span')
  typeSpan.className = 'type'
  typeSpan.textContent = TYPE_LABEL[it.type] + (it.pinned ? ' 📌' : '')
  const timeSpan = document.createElement('span')
  timeSpan.textContent = timeAgo(it.createdAt)
  meta.append(typeSpan, timeSpan)
  card.appendChild(meta)

  if (isImg) {
    const thumb = document.createElement('div')
    thumb.className = 'thumb'
    thumb.style.backgroundImage = `url(${it.content})`
    card.appendChild(thumb)
  } else {
    const content = document.createElement('div')
    content.className = 'content'
    content.textContent = it.content // textContent → XSS 안전
    card.appendChild(content)
  }

  const copied = document.createElement('div')
  copied.className = 'copied'
  copied.textContent = '✓ 복사됨'
  card.appendChild(copied)

  card.addEventListener('click', () => {
    sel = index
    selectAt(index)
    void doCopy(it, card)
  })
  card.addEventListener('dblclick', () => {
    void doPaste(it)
  })

  return card
}

function render(): void {
  const vis = visible()
  if (sel >= vis.length) sel = Math.max(0, vis.length - 1)

  listEl.innerHTML = ''
  vis.forEach((it, i) => listEl.appendChild(buildCard(it, i)))

  const has = vis.length > 0
  emptyEl.classList.toggle('show', !has)
  if (!has) {
    emptyMsgEl.textContent =
      filter || tab !== '전체' ? '조건에 맞는 항목이 없어요' : '클립보드가 비어 있어요'
  }
  countHintEl.textContent = `${vis.length}개`
  stateEl.textContent = `총 ${items.length}개`

  document.querySelectorAll<HTMLElement>('#tabs .tab').forEach((t) => {
    const name = t.dataset['tab'] ?? ''
    const n =
      name === '전체' ? items.length : items.filter((it) => TYPE_LABEL[it.type] === name).length
    const cnt = t.querySelector('.cnt')
    if (cnt) cnt.textContent = n ? String(n) : ''
  })

  updateRowH()
}

async function reload(): Promise<void> {
  const hist = await window.copyManager.getHistory()
  items = [...hist].reverse() // 최신 먼저
  render()
}

// 탭 전환
document.querySelectorAll<HTMLElement>('#tabs .tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.remove('on'))
    t.classList.add('on')
    tab = t.dataset['tab'] ?? '전체'
    sel = 0
    render()
  })
})

// 검색 필터 (B 검색우선)
searchEl.addEventListener('input', () => {
  filter = searchEl.value
  sel = 0
  render()
})

// D6: 키보드 그리드 탐색. 창이 포커스를 유지하므로 조작 중 blur→hide 가 발생하지 않음(안 닫힘).
document.addEventListener('keydown', (e) => {
  const onSearch = document.activeElement === searchEl
  // 검색창 입력 중엔 ↑↓/Enter 만 그리드로 가로챈다(좌우는 캐럿 이동 허용)
  if (onSearch && !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return

  const vis = visible()
  if (vis.length === 0) return

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      sel = Math.min(sel + 1, vis.length - 1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      sel = Math.max(sel - 1, 0)
      break
    case 'ArrowDown':
      e.preventDefault()
      sel = Math.min(sel + COLS, vis.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      sel = Math.max(sel - COLS, 0)
      break
    case 'Enter': {
      e.preventDefault()
      const it = vis[sel]
      if (it) void doPaste(it)
      return
    }
    default:
      return
  }
  selectAt(sel)
})

window.addEventListener('resize', updateRowH)

// 새 항목 적재 시 main 이 push → 그리드 갱신(폴링 대신 이벤트 기반)
window.copyManager.onHistoryChanged(() => {
  void reload()
})

void reload()
