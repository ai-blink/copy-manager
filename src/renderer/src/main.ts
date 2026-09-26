import type { ClipItem, ClipType } from '../../shared/clipboard-store'
import type { AppSettings, AppTheme, ToastTheme } from '../../shared/settings'
import {
  t,
  type I18nKey,
  type Lang,
  type LanguagePref,
  type WithResolvedLanguage
} from '../../shared/i18n'
import { mountScrollRemote } from './scroll-remote'

// 렌더러(vanilla TS). mockup v4 로직을 타입 안전하게 포팅.
// S3: 그리드 렌더 · 타입 탭 · 검색 · 키보드 탐색 · 클릭=복사 · Enter=붙여넣기.
// S4: 스크롤 리모컨(scroll-remote.ts).
// S5: 카드 액션 📌⋯🗑️ · 우클릭 메뉴 · 상세/확인/설정 모달 · 설정 적용.
// D42: i18n. IPC 로 오는 설정에는 항상 현재 표시 언어(resolvedLanguage)가 붙는다.

type ClientSettings = WithResolvedLanguage<AppSettings>

/** 현재 표시 언어. initAppInfo/applySettings 가 채운 뒤에만 유효(초기값은 임시). */
let lang: Lang = 'en'
let i18nApplied = false

const TYPE_LABEL_KEY: Record<ClipType, I18nKey> = {
  text: 'type.text',
  image: 'type.image',
  link: 'type.link',
  code: 'type.code'
}
function typeLabel(type: ClipType): string {
  return t(lang, TYPE_LABEL_KEY[type])
}

const TOAST_MS = 900 // 복사 토스트 노출 시간
// 토스트 배색 클래스. shared/settings 의 ToastTheme 과 짝이지만, 렌더러는 그 모듈을
// `import type` 으로만 참조해야 하므로(런타임 node:fs 누출 금지) 목록을 여기 둔다.
const TOAST_THEME_CLASSES: Record<ToastTheme, string> = {
  dark: 'toast-dark',
  accent: 'toast-accent',
  mint: 'toast-mint',
  black: 'toast-black'
}
// 토스트는 최대 3줄까지 보여주므로(CSS line-clamp) 그만큼은 내용을 넘긴다.
const TOAST_CONTENT_MAX = 100
const LIGHT_TOAST_MIN_OPACITY = 0.76

let cols = 3 // D4: 한 줄 카드 수(설정 모달에서 2~5 변경). 시작값 3.

type TabKey = 'all' | ClipType
let items: ClipItem[] = [] // 최신이 앞(store 는 [old...new] 라 reverse)
let tab: TabKey = 'all'
let filter = ''
let sel = 0
// 검색어를 편집하는 상태와, 검색 결과 카드 4방향을 탐색하는 상태를 구분한다.
// DOM 포커스는 검색창에 남겨 IME·즉시 재검색을 보존하고, 방향키 해석만 전환한다.
let isResultNavigation = false
let keepCount = 100
let toastTimer: number | undefined

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`element #${id} not found`)
  return el as T
}

const listEl = $<HTMLDivElement>('list')
const bodyAreaEl = $<HTMLDivElement>('bodyArea')
const dragZoneEl = $<HTMLDivElement>('dragZone')
const toastEl = $<HTMLDivElement>('toast')
const toastPreviewEl = $<HTMLDivElement>('setToastPreview')
const emptyEl = $<HTMLDivElement>('empty')
const emptyMsgEl = $<HTMLDivElement>('emptyMsg')
const countHintEl = $<HTMLSpanElement>('countHint')
const searchEl = $<HTMLInputElement>('search')
const stateEl = $<HTMLSpanElement>('state')
const appTitleEl = $<HTMLSpanElement>('appTitle')

function visible(): ClipItem[] {
  const f = filter.toLowerCase()
  return items.filter((it) => (tab === 'all' || it.type === tab) && it.content.toLowerCase().includes(f))
}

function updateRowH(): void {
  const padX = 16
  const gap = 10
  const cw = listEl.clientWidth - padX
  const cardW = (cw - gap * (cols - 1)) / cols
  // D4: 카드 4:3 균일 → 행 높이를 카드폭×3/4 로 JS 고정(겹침 방지)
  document.documentElement.style.setProperty('--rowh', `${Math.max(96, (cardW * 3) / 4)}px`)
}

/**
 * 카드가 없는 본문 여백만 OS 창 드래그 영역으로 만든다.
 * 목록 자체를 드래그 영역으로 만들면 카드 클릭·휠·스크롤바와 충돌하므로, 마지막 카드 아래에
 * 실제로 보이는 빈 영역이 있을 때만 그 높이만큼의 별도 영역을 둔다.
 */
function updateDragZone(): void {
  const lastCard = listEl.lastElementChild as HTMLElement | null
  if (!lastCard) {
    dragZoneEl.style.height = '0px'
    return
  }

  const top = Math.max(0, lastCard.offsetTop + lastCard.offsetHeight - listEl.scrollTop)
  const height = Math.max(0, listEl.clientHeight - top)
  dragZoneEl.style.top = `${top}px`
  dragZoneEl.style.height = `${height}px`
}

function selectAt(i: number): void {
  ;[...listEl.children].forEach((c, j) => c.classList.toggle('sel', j === i))
  const node = listEl.children[i]
  if (node) node.scrollIntoView({ block: 'nearest' })
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return t(lang, 'timeAgo.justNow')
  if (s < 3600) return t(lang, 'timeAgo.minutes', { n: Math.floor(s / 60) })
  if (s < 86400) return t(lang, 'timeAgo.hours', { n: Math.floor(s / 3600) })
  return t(lang, 'timeAgo.days', { n: Math.floor(s / 86400) })
}

/**
 * 복사 피드백은 카드가 아니라 창 하단 고정 토스트로 알린다(D34).
 * 복사한 카드는 곧바로 맨 앞으로 승격돼 위치가 바뀌므로, 피드백을 카드에 붙이면
 * 시선이 원래 누른 자리에 남아 놓치게 된다. 위치가 고정이면 이동과 무관하게 보인다.
 */
function showToast(text: string): void {
  toastEl.textContent = text
  toastEl.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), TOAST_MS)
}

/** 토스트에 보여줄 복사 내용 요약. 넘치는 부분은 CSS 3줄 클램프가 다시 접는다. */
function copyToastText(item: ClipItem): string {
  if (item.type === 'image') return t(lang, 'toast.imageCopied')
  const oneLine = item.content.replace(/\s+/g, ' ').trim()
  const head =
    oneLine.length > TOAST_CONTENT_MAX ? `${oneLine.slice(0, TOAST_CONTENT_MAX)}…` : oneLine
  return t(lang, 'toast.copied', { content: head })
}

async function doCopy(item: ClipItem): Promise<void> {
  const ok = await window.copyManager.copy(item.id)
  if (!ok) return
  showToast(copyToastText(item))
  // 승격으로 맨 앞에 오므로 선택도 따라 옮기고, 이동한 카드가 보이도록 스크롤한다.
  sel = 0
  render()
  selectAt(0)
}

/** 더블클릭 판정용: 연속 클릭의 첫 번째가 가리킨 항목(재정렬 전 대상). */
let firstClickItem: ClipItem | null = null

async function doPaste(item: ClipItem): Promise<void> {
  await window.copyManager.paste(item.id)
}

function buildCard(it: ClipItem, index: number): HTMLDivElement {
  const card = document.createElement('div')
  const isImg = it.type === 'image'
  card.className = `card${index === sel ? ' sel' : ''}${isImg ? ' img' : ''}${
    it.type === 'code' ? ' code' : ''
  }${it.pinned ? ' pinned' : ''}`

  // S5 카드 액션: 📌 핀 · ⋯ 상세 · 🗑️ 삭제 (호버 시 노출, D13)
  const actions = document.createElement('div')
  actions.className = 'actions'
  const pinAct = document.createElement('span')
  pinAct.className = 'act pin'
  pinAct.textContent = '📌'
  pinAct.title = it.pinned ? t(lang, 'card.unpin') : t(lang, 'card.pin')
  pinAct.addEventListener('click', (e) => {
    e.stopPropagation()
    void togglePin(it)
  })
  const moreAct = document.createElement('span')
  moreAct.className = 'act more'
  moreAct.textContent = '⋯'
  moreAct.title = t(lang, 'card.detail')
  moreAct.addEventListener('click', (e) => {
    e.stopPropagation()
    openDetail(it)
  })
  const delAct = document.createElement('span')
  delAct.className = 'act del'
  delAct.textContent = '🗑️'
  delAct.title = t(lang, 'card.delete')
  delAct.addEventListener('click', (e) => {
    e.stopPropagation()
    askDelete(it)
  })
  actions.append(pinAct, moreAct, delAct)
  card.appendChild(actions)

  const meta = document.createElement('div')
  meta.className = 'meta'
  const typeSpan = document.createElement('span')
  typeSpan.className = 'type'
  typeSpan.textContent = typeLabel(it.type) + (it.pinned ? ' 📌' : '')
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

  // 첫 클릭의 doCopy가 카드를 맨 앞으로 재정렬해 다시 그리므로, 더블클릭의 두 번째 클릭은
  // 같은 자리의 "다른" 카드에 떨어진다. 그래서 dblclick 대신 click의 detail로 판정하고
  // 붙여넣을 항목은 첫 클릭 때 잡아 둔 것을 쓴다.
  card.addEventListener('click', (e) => {
    if (e.detail >= 2) {
      if (e.detail === 2) void doPaste(firstClickItem ?? it)
      return
    }
    firstClickItem = it
    sel = index
    isResultNavigation = true
    selectAt(index)
    void doCopy(it)
  })
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    sel = index
    selectAt(index)
    openCtx(e.clientX, e.clientY, it)
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
    emptyMsgEl.textContent = t(lang, filter || tab !== 'all' ? 'empty.noResults' : 'empty.noHistory')
  }
  countHintEl.textContent = t(lang, 'countFormat.shown', { shown: vis.length, max: keepCount })
  countHintEl.title = t(lang, 'search.countHint')
  stateEl.textContent = t(lang, 'state.total', { n: items.length })

  document.querySelectorAll<HTMLElement>('#tabs .tab').forEach((el) => {
    const key = (el.dataset['tab'] ?? 'all') as TabKey
    const n = key === 'all' ? items.length : items.filter((it) => it.type === key).length
    const cnt = el.querySelector('.cnt')
    if (cnt) cnt.textContent = n ? String(n) : ''
  })

  updateRowH()
  updateDragZone()
}

async function reload(): Promise<void> {
  const hist = await window.copyManager.getHistory()
  const previousLatest = items[0]
  const nextItems = [...hist].reverse() // 최신 먼저
  const nextLatest = nextItems[0]
  const latestChanged =
    nextLatest?.id !== previousLatest?.id || nextLatest?.createdAt !== previousLatest?.createdAt
  items = nextItems
  render()
  // 새 캡처와 재복사 승격(D34)은 항상 맨 위에서 보이게 한다.
  if (latestChanged) listEl.scrollTop = 0
}

// 탭 전환
document.querySelectorAll<HTMLElement>('#tabs .tab').forEach((el) => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.remove('on'))
    el.classList.add('on')
    tab = (el.dataset['tab'] as TabKey | undefined) ?? 'all'
    sel = 0
    isResultNavigation = false
    render()
  })
})

// 검색 필터 (B 검색우선)
searchEl.addEventListener('input', () => {
  filter = searchEl.value
  sel = 0
  isResultNavigation = false
  render()
})
// 검색창을 직접 가리키면 다시 텍스트 편집이 우선이라는 의도다.
searchEl.addEventListener('pointerdown', () => {
  isResultNavigation = false
})

// D6/D39: 검색 입력과 카드 그리드 탐색을 한 키보드 흐름으로 연결한다.
document.addEventListener('keydown', (e) => {
  // 한글 등 IME 조합·후보 선택 중에는 방향키와 Enter를 운영체제 입력기에 맡긴다.
  if (e.isComposing) return

  // 모달이 열려 있으면 Esc 로만 닫고 그리드 탐색은 막는다(S5)
  const openOv = document.querySelector<HTMLElement>('.overlay.show')
  if (openOv) {
    if (e.key === 'Escape') closeOverlay(openOv)
    return
  }

  const onSearch = document.activeElement === searchEl
  if (onSearch) {
    if (!isResultNavigation) {
      // 단일 줄 검색창의 ↑↓는 결과 탐색 진입으로만 사용한다. ←→는 언제나 캐럿 이동이다.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        isResultNavigation = true
      } else if (e.key !== 'Enter') {
        return
      }
    } else if (e.key === 'Escape') {
      // 검색어를 지우지 않고 편집 모드로만 되돌린다.
      e.preventDefault()
      isResultNavigation = false
      return
    } else if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      // 문자·Backspace 등 편집 입력은 검색 모드로 돌려 브라우저 기본 동작을 보존한다.
      isResultNavigation = false
      return
    }
  }

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
      sel = Math.min(sel + cols, vis.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      sel = Math.max(sel - cols, 0)
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

window.addEventListener('resize', () => {
  updateRowH()
  updateDragZone()
})
listEl.addEventListener('scroll', updateDragZone)

// 새 항목 적재 시 main 이 push → 그리드 갱신(폴링 대신 이벤트 기반)
window.copyManager.onHistoryChanged(() => {
  void reload()
})

// S4: 창 내부 플로팅 스크롤 리모컨(느슨 결합 컴포넌트). ⚙ → 설정 모달(S5).
const remote = mountScrollRemote({
  target: listEl,
  container: bodyAreaEl,
  onSettings: () => openSettings(),
  labels: {
    drag: t(lang, 'remote.drag'),
    settings: t(lang, 'remote.settings'),
    dwell: t(lang, 'settingsModal.remote.modeDwell'),
    click: t(lang, 'settingsModal.remote.modeClick')
  }
})

// ===== S5: 모달 · 우클릭 메뉴 · 카드 액션 · 설정 =====

function openOverlay(id: string): void {
  $(id).classList.add('show')
}
function closeOverlay(el: HTMLElement): void {
  el.classList.remove('show')
}
function showNotice(title: string, msg: string): void {
  $('noticeTitle').textContent = title
  $('noticeMsg').textContent = msg
  openOverlay('noticeOverlay')
}
type SettingsTab = 'general' | 'display' | 'history' | 'remote' | 'security'
let activeSettingsTab: SettingsTab = 'general'
function showSettingsTab(tab: SettingsTab): void {
  activeSettingsTab = tab
  document.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach((button) => {
    const active = button.dataset['settingsTab'] === tab
    button.classList.toggle('on', active)
    button.setAttribute('aria-selected', String(active))
  })
  document.querySelectorAll<HTMLElement>('[data-settings-panel]').forEach((panel) => {
    panel.classList.toggle('show', panel.dataset['settingsPanel'] === tab)
  })
}
function openSettings(): void {
  showSettingsTab(activeSettingsTab)
  openOverlay('setOverlay')
}
document.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset['settingsTab'] as SettingsTab | undefined
    if (tab) showSettingsTab(tab)
  })
})
// 배경 클릭 / [data-close] 로 모달 닫기
document.querySelectorAll<HTMLElement>('.overlay').forEach((ov) => {
  ov.addEventListener('click', (e) => {
    if (e.target === ov) closeOverlay(ov)
  })
  ov.querySelectorAll<HTMLElement>('[data-close]').forEach((b) =>
    b.addEventListener('click', () => closeOverlay(ov))
  )
})

// 확인 모달 (D15 비가역 방지)
let confirmCb: (() => void) | null = null
function askConfirm(title: string, msg: string, yesLabel: string, cb: () => void): void {
  $('confirmTitle').textContent = title
  $('confirmMsg').textContent = msg
  $('confirmYes').textContent = yesLabel
  confirmCb = cb
  openOverlay('confirmOverlay')
}
$('confirmNo').addEventListener('click', () => closeOverlay($('confirmOverlay')))
$('confirmYes').addEventListener('click', () => {
  closeOverlay($('confirmOverlay'))
  const cb = confirmCb
  confirmCb = null
  cb?.()
})

// 항목 핀/삭제 (변경은 history:changed → reload 로 반영)
async function togglePin(it: ClipItem): Promise<void> {
  await window.copyManager.pinItem(it.id, !it.pinned)
}
function askDelete(it: ClipItem): void {
  askConfirm(
    t(lang, 'confirmDelete.title'),
    t(lang, 'confirmDelete.msg'),
    t(lang, 'confirmDelete.yes'),
    () => {
      void window.copyManager.deleteItem(it.id)
    }
  )
}

// 상세 모달 (D14)
let detailItem: ClipItem | null = null
function openDetail(it: ClipItem): void {
  detailItem = it
  $('detailType').textContent =
    `${typeLabel(it.type)} · ${timeAgo(it.createdAt)}${it.pinned ? ' · 📌' : ''}`
  const wrap = $<HTMLDivElement>('detailWrap')
  wrap.innerHTML = ''
  if (it.type === 'image') {
    const thumb = document.createElement('div')
    thumb.className = 'detail-thumb'
    thumb.style.backgroundImage = `url(${it.content})`
    wrap.appendChild(thumb)
  } else {
    const c = document.createElement('div')
    c.className = `detail-content${it.type === 'code' ? ' code' : ''}`
    c.textContent = it.content // textContent → XSS 안전
    wrap.appendChild(c)
  }
  openOverlay('detailOverlay')
}
$('detailPaste').addEventListener('click', () => {
  const it = detailItem
  closeOverlay($('detailOverlay'))
  if (it) void doPaste(it)
})
$('detailPin').addEventListener('click', () => {
  if (detailItem) void togglePin(detailItem)
})
$('detailDel').addEventListener('click', () => {
  const it = detailItem
  closeOverlay($('detailOverlay'))
  if (it) askDelete(it)
})

// 우클릭 메뉴 (D13)
const ctxEl = $<HTMLDivElement>('ctx')
let ctxItem: ClipItem | null = null
function openCtx(x: number, y: number, it: ClipItem): void {
  ctxItem = it
  $('ctxPin').textContent = it.pinned ? t(lang, 'card.unpin') : t(lang, 'card.pin')
  ctxEl.style.left = `${Math.min(x, window.innerWidth - 190)}px`
  ctxEl.style.top = `${Math.min(y, window.innerHeight - 200)}px`
  ctxEl.classList.add('show')
}
document.addEventListener('click', () => ctxEl.classList.remove('show'))
ctxEl.querySelectorAll<HTMLElement>('.mi').forEach((mi) => {
  mi.addEventListener('click', () => {
    const act = mi.dataset['act']
    const it = ctxItem
    if (!it) return
    if (act === 'copy') {
      void doCopy(it)
    } else if (act === 'paste') {
      void doPaste(it)
    } else if (act === 'detail') {
      openDetail(it)
    } else if (act === 'pin') {
      void togglePin(it)
    } else if (act === 'del') {
      askDelete(it)
    }
  })
})

// 설정 (D17) — 설정 모달이 단일 소스. 변경 시 patchSettings → main 영속 → applySettings.
const hotkeyMod1El = $<HTMLSelectElement>('setHotkeyMod1')
const hotkeyMod2El = $<HTMLSelectElement>('setHotkeyMod2')
const hotkeyKeyEl = $<HTMLSelectElement>('setHotkeyKey')
const HOTKEY_MODIFIERS = new Set(['CommandOrControl', 'Alt', 'Shift'])

function hasOption(select: HTMLSelectElement, value: string): boolean {
  return [...select.options].some((option) => option.value === value)
}

function normalizeHotkeyModifier(value: string): string {
  return value === 'Control' || value === 'Ctrl' ? 'CommandOrControl' : value
}

function syncHotkeyControls(hotkey: string): void {
  const parts = hotkey.split('+')
  const modifiers = parts.slice(0, -1).map(normalizeHotkeyModifier).filter((part) => HOTKEY_MODIFIERS.has(part))
  const key = parts.at(-1) ?? ''
  const first = modifiers[0]
  const second = modifiers[1] ?? ''
  if (first && hasOption(hotkeyMod1El, first)) hotkeyMod1El.value = first
  if (hasOption(hotkeyMod2El, second) && second !== hotkeyMod1El.value) hotkeyMod2El.value = second
  if (hasOption(hotkeyKeyEl, key)) hotkeyKeyEl.value = key
  $('setHotkeyPreview').textContent = hotkey
    .split('+')
    .map((part) => (part === 'CommandOrControl' ? 'Ctrl' : part))
    .join(' + ')
}

async function commitHotkey(): Promise<void> {
  if (hotkeyMod1El.value === hotkeyMod2El.value) hotkeyMod2El.value = ''
  const hotkey = [hotkeyMod1El.value, hotkeyMod2El.value, hotkeyKeyEl.value]
    .filter(Boolean)
    .join('+')
  const result = await window.copyManager.setHotkey(hotkey)
  applySettings(result.settings)
  if (!result.ok) {
    showNotice(t(lang, 'hotkeyConflict.title'), t(lang, 'hotkeyConflict.msg'))
  }
}

function syncSettingsControls(s: AppSettings): void {
  syncHotkeyControls(s.hotkey)
  $('setColsV').textContent = String(s.cols)
  document
    .querySelectorAll<HTMLElement>('#setColsRow .chip')
    .forEach((c) => c.classList.toggle('on', Number(c.dataset['cols']) === s.cols))
  const uiScalePct = Math.round(s.uiScale * 100)
  $<HTMLInputElement>('setUiScale').value = String(uiScalePct)
  $('setUiScaleV').textContent = `${uiScalePct}%`
  document
    .querySelectorAll<HTMLElement>('#setPlacementGrid .chip')
    .forEach((c) => c.classList.toggle('on', c.dataset['placement'] === s.windowPlacement))
  document
    .querySelectorAll<HTMLElement>('#setAppThemeRow .chip')
    .forEach((c) => c.classList.toggle('on', c.dataset['appTheme'] === s.appTheme))
  document
    .querySelectorAll<HTMLElement>('#setLanguageRow .chip')
    .forEach((c) => c.classList.toggle('on', c.dataset['language'] === s.language))
  $<HTMLInputElement>('setKeep').value = String(s.keepCount)
  document
    .querySelectorAll<HTMLElement>('#setKeepPresets .chip')
    .forEach((c) => c.classList.toggle('on', Number(c.dataset['keep']) === s.keepCount))
  const opPct = Math.round(s.remoteOpacity * 100)
  $<HTMLInputElement>('setOp').value = String(opPct)
  $('setOpV').textContent = `${opPct}%`
  $<HTMLInputElement>('setDwell').value = String(s.dwellMs)
  $('setDwellV').textContent = `${s.dwellMs}ms`
  $<HTMLInputElement>('setSpeed').value = String(s.scrollSpeed)
  $('setSpeedV').textContent = String(s.scrollSpeed)
  document
    .querySelectorAll<HTMLElement>('#setModeRow .chip')
    .forEach((c) => c.classList.toggle('on', c.dataset['mode'] === s.remoteMode))
  document
    .querySelectorAll<HTMLElement>('#setToastThemeRow .chip')
    .forEach((c) => c.classList.toggle('on', c.dataset['toastTheme'] === s.toastTheme))
  $<HTMLInputElement>('setToastOp').value = String(s.toastOpacity)
  $('setToastOpV').textContent = s.toastOpacity.toFixed(2)
  $<HTMLInputElement>('setToastFs').value = String(s.toastFontSize)
  $('setToastFsV').textContent = `${s.toastFontSize}px`
  $<HTMLInputElement>('setToastPy').value = String(s.toastPadY)
  $('setToastPyV').textContent = `${s.toastPadY}px`
  $<HTMLInputElement>('setToastPx').value = String(s.toastPadX)
  $('setToastPxV').textContent = `${s.toastPadX}px`
  $<HTMLInputElement>('remoteEnabled').checked = s.remoteEnabled
  $<HTMLInputElement>('keepOpen').checked = s.keepOpen
  $<HTMLInputElement>('rebootReset').checked = s.rebootReset
  $<HTMLInputElement>('contentProtection').checked = s.contentProtection
  $<HTMLInputElement>('launchAtStartup').checked = s.launchAtStartup
}

function toastSurfaceOpacity(opacity: number, appTheme: AppTheme): number {
  return appTheme === 'light' ? Math.max(opacity, LIGHT_TOAST_MIN_OPACITY) : opacity
}

/** 토스트 배색·수치를 실제 토스트와 설정 미리보기 양쪽에 반영한다(D34). */
function applyToastStyle(s: AppSettings): void {
  const root = document.documentElement.style
  root.setProperty('--toast-op', String(s.toastOpacity))
  root.setProperty('--toast-surface-op', String(toastSurfaceOpacity(s.toastOpacity, s.appTheme)))
  root.setProperty('--toast-fs', `${s.toastFontSize}px`)
  root.setProperty('--toast-py', `${s.toastPadY}px`)
  root.setProperty('--toast-px', `${s.toastPadX}px`)
  const active = TOAST_THEME_CLASSES[s.toastTheme]
  for (const el of [toastEl, toastPreviewEl]) {
    Object.values(TOAST_THEME_CLASSES).forEach((cls) => el.classList.toggle(cls, cls === active))
  }
}

/** 정적 HTML 문자열(data-i18n*)과, i18n 사전을 직접 쓰는 동적 조각을 현재 언어로 채운다. */
function applyI18n(): void {
  document.documentElement.lang = lang
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset['i18n'] as I18nKey | undefined
    if (key) el.textContent = t(lang, key)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset['i18nTitle'] as I18nKey | undefined
    if (key) el.title = t(lang, key)
  })
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset['i18nPlaceholder'] as I18nKey | undefined
    if (key) el.placeholder = t(lang, key)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    const key = el.dataset['i18nAriaLabel'] as I18nKey | undefined
    if (key) el.setAttribute('aria-label', t(lang, key))
  })
  remote.setLabels({
    drag: t(lang, 'remote.drag'),
    settings: t(lang, 'remote.settings'),
    dwell: t(lang, 'settingsModal.remote.modeDwell'),
    click: t(lang, 'settingsModal.remote.modeClick')
  })
  render() // 카드 타입 라벨·시간 표시 등 동적 텍스트 재계산
}

function applySettings(s: ClientSettings): void {
  const langChanged = !i18nApplied || s.resolvedLanguage !== lang
  lang = s.resolvedLanguage
  cols = s.cols
  keepCount = s.keepCount
  document.documentElement.dataset['appTheme'] = s.appTheme
  applyToastStyle(s)
  setAotBtn(s.alwaysOnTop)
  document.documentElement.style.setProperty('--cols', String(s.cols))
  remote.setOpacity(s.remoteOpacity)
  remote.setDwellMs(s.dwellMs)
  remote.setSpeed(s.scrollSpeed)
  remote.setMode(s.remoteMode)
  remote.setVisible(s.remoteEnabled)
  syncSettingsControls(s)
  applyI18n()
  i18nApplied = true
  if (langChanged) void initAppInfo() // 창 제목 등 main 이 미리 현지화한 문자열 새로고침
  updateRowH()
}

async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  const updated = await window.copyManager.setSettings(patch)
  applySettings(updated)
}

// 카드 수 / 활성화 방식 칩
document
  .querySelectorAll<HTMLElement>('#setColsRow .chip')
  .forEach((c) =>
    c.addEventListener('click', () => {
      const n = Number(c.dataset['cols'])
      if (n) void patchSettings({ cols: n })
    })
  )

document.querySelectorAll<HTMLElement>('#setPlacementGrid .chip').forEach((c) =>
  c.addEventListener('click', () => {
    const placement = c.dataset['placement'] as AppSettings['windowPlacement'] | undefined
    if (placement) void patchSettings({ windowPlacement: placement })
  })
)

document.querySelectorAll<HTMLElement>('#setAppThemeRow .chip').forEach((c) =>
  c.addEventListener('click', () => {
    const appTheme = c.dataset['appTheme'] as AppTheme | undefined
    if (appTheme === 'dark' || appTheme === 'light') void patchSettings({ appTheme })
  })
)

document.querySelectorAll<HTMLElement>('#setLanguageRow .chip').forEach((c) =>
  c.addEventListener('click', () => {
    const language = c.dataset['language'] as LanguagePref | undefined
    if (language === 'system' || language === 'en' || language === 'ko') {
      void patchSettings({ language })
    }
  })
)

document.querySelectorAll<HTMLElement>('#setModeRow .chip').forEach((c) =>
  c.addEventListener('click', () => {
    const m = c.dataset['mode']
    if (m === 'dwell' || m === 'click') void patchSettings({ remoteMode: m })
  })
)

// 유지 개수: 직접 입력은 change/Enter, 빠른 값은 클릭 즉시 영속.
const setKeepEl = $<HTMLInputElement>('setKeep')
function commitKeepCount(): void {
  if (!Number.isFinite(setKeepEl.valueAsNumber)) {
    void initSettings()
    return
  }
  void patchSettings({ keepCount: setKeepEl.valueAsNumber })
}
setKeepEl.addEventListener('change', commitKeepCount)
setKeepEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitKeepCount()
  }
})
document.querySelectorAll<HTMLElement>('#setKeepPresets .chip').forEach((c) => {
  c.addEventListener('click', () => {
    const keepCount = Number(c.dataset['keep'])
    if (Number.isInteger(keepCount)) void patchSettings({ keepCount })
  })
})

// 토스트 배색 칩
document.querySelectorAll<HTMLElement>('#setToastThemeRow .chip').forEach((c) => {
  c.addEventListener('click', () => {
    const toastTheme = c.dataset['toastTheme'] as ToastTheme | undefined
    if (toastTheme) void patchSettings({ toastTheme })
  })
})

/**
 * 토스트 수치 슬라이더 — 드래그 중(input)에는 CSS 변수만 바꿔 미리보기에 즉시 비치고,
 * 손을 뗄 때(change) 한 번만 영속한다(드래그마다 파일을 쓰지 않도록).
 */
function bindToastRange(
  id: string,
  valueId: string,
  cssVar: string,
  format: (v: string) => string,
  toPatch: (v: number) => Partial<AppSettings>
): void {
  const el = $<HTMLInputElement>(id)
  el.addEventListener('input', () => {
    const shown = format(el.value)
    $(valueId).textContent = shown
    document.documentElement.style.setProperty(cssVar, shown)
    if (cssVar === '--toast-op') {
      const appTheme = document.documentElement.dataset['appTheme'] as AppTheme | undefined
      document.documentElement.style.setProperty(
        '--toast-surface-op',
        String(toastSurfaceOpacity(Number(el.value), appTheme === 'light' ? 'light' : 'dark'))
      )
    }
  })
  el.addEventListener('change', () => void patchSettings(toPatch(Number(el.value))))
}

bindToastRange('setToastOp', 'setToastOpV', '--toast-op', (v) => v, (v) => ({ toastOpacity: v }))
bindToastRange(
  'setToastFs',
  'setToastFsV',
  '--toast-fs',
  (v) => `${v}px`,
  (v) => ({ toastFontSize: v })
)
bindToastRange('setToastPy', 'setToastPyV', '--toast-py', (v) => `${v}px`, (v) => ({ toastPadY: v }))
bindToastRange('setToastPx', 'setToastPxV', '--toast-px', (v) => `${v}px`, (v) => ({ toastPadX: v }))

const setUiScaleEl = $<HTMLInputElement>('setUiScale')
setUiScaleEl.addEventListener('input', () => {
  $('setUiScaleV').textContent = `${setUiScaleEl.value}%`
})
setUiScaleEl.addEventListener('change', () =>
  void patchSettings({ uiScale: Number(setUiScaleEl.value) / 100 })
)

const setOpEl = $<HTMLInputElement>('setOp')
setOpEl.addEventListener('input', () => {
  $('setOpV').textContent = `${setOpEl.value}%`
  remote.setOpacity(Number(setOpEl.value) / 100)
})
setOpEl.addEventListener('change', () =>
  void patchSettings({ remoteOpacity: Number(setOpEl.value) / 100 })
)

const setDwellEl = $<HTMLInputElement>('setDwell')
setDwellEl.addEventListener('input', () => {
  $('setDwellV').textContent = `${setDwellEl.value}ms`
  remote.setDwellMs(Number(setDwellEl.value))
})
setDwellEl.addEventListener('change', () => void patchSettings({ dwellMs: Number(setDwellEl.value) }))

const setSpeedEl = $<HTMLInputElement>('setSpeed')
setSpeedEl.addEventListener('input', () => {
  $('setSpeedV').textContent = setSpeedEl.value
  remote.setSpeed(Number(setSpeedEl.value))
})
setSpeedEl.addEventListener('change', () =>
  void patchSettings({ scrollSpeed: Number(setSpeedEl.value) })
)

hotkeyMod1El.addEventListener('change', () => void commitHotkey())
hotkeyMod2El.addEventListener('change', () => void commitHotkey())
hotkeyKeyEl.addEventListener('change', () => void commitHotkey())

$<HTMLInputElement>('rebootReset').addEventListener('change', (e) => {
  void patchSettings({ rebootReset: (e.target as HTMLInputElement).checked })
})

// Alt+F4와 헤더 ✕는 창 숨김으로 통일한다. 완전 종료는 설정의 명시적 버튼만 제공한다.
$('quitAppBtn').addEventListener('click', () => window.copyManager.quitApp())

$('memReset').addEventListener('click', () => {
  askConfirm(
    t(lang, 'confirmMemReset.title'),
    t(lang, 'confirmMemReset.msg'),
    t(lang, 'confirmMemReset.yes'),
    () => void window.copyManager.resetMemory()
  )
})
$('noticeOk').addEventListener('click', () => closeOverlay($('noticeOverlay')))

// 헤더 버튼
$('setBtn').addEventListener('click', openSettings)
$('clearBtn').addEventListener('click', () => {
  askConfirm(
    t(lang, 'confirmClearAll.title'),
    t(lang, 'confirmClearAll.msg'),
    t(lang, 'confirmClearAll.yes'),
    () => void window.copyManager.clearUnpinned()
  )
})
function askRemoveDuplicates(): void {
  askConfirm(
    t(lang, 'confirmDedupe.title'),
    t(lang, 'confirmDedupe.msg'),
    t(lang, 'confirmDedupe.yes'),
    () => {
      void window.copyManager.removeDuplicates().then((removed) => {
        stateEl.textContent =
          removed > 0 ? t(lang, 'state.dedupedRemoved', { n: removed }) : t(lang, 'state.dedupedNone')
      })
    }
  )
}
$('dedupeBtn').addEventListener('click', askRemoveDuplicates)
$('settingsDedupeBtn').addEventListener('click', askRemoveDuplicates)
// ✕ 닫기 — 창 숨김(핫키 재누름과 동일 효과). D5 갱신
$('closeBtn').addEventListener('click', () => window.copyManager.hideWindow())
// 📌 항상 위(alwaysOnTop) 토글. 창 유지(keepOpen)와 별개 — 항상위만 on/off.
const winPinBtn = $('winPinBtn')
function setAotBtn(on: boolean): void {
  winPinBtn.classList.toggle('on', on)
  winPinBtn.title = on ? t(lang, 'header.pinOn') : t(lang, 'header.pinOff')
}
winPinBtn.addEventListener('click', () => {
  void window.copyManager.toggleAlwaysOnTop().then(setAotBtn)
})
// 스크롤 리모컨 표시(remoteEnabled) — 설정 "스크롤 리모컨 사용" 체크박스 전용 (D34)
$<HTMLInputElement>('remoteEnabled').addEventListener('change', (e) =>
  void patchSettings({ remoteEnabled: (e.target as HTMLInputElement).checked })
)
// 창 유지(keepOpen)는 설정 "창 유지" 체크박스 전용
$<HTMLInputElement>('keepOpen').addEventListener('change', (e) =>
  void patchSettings({ keepOpen: (e.target as HTMLInputElement).checked })
)
// 화면 캡처 방지(contentProtection) — 설정 "화면 캡처 방지" 체크박스 전용 (D28)
$<HTMLInputElement>('contentProtection').addEventListener('change', (e) =>
  void patchSettings({ contentProtection: (e.target as HTMLInputElement).checked })
)
// 윈도우 시작 시 자동 실행(launchAtStartup) — 설정 체크박스 전용 (D30)
$<HTMLInputElement>('launchAtStartup').addEventListener('change', (e) =>
  void patchSettings({ launchAtStartup: (e.target as HTMLInputElement).checked })
)

// 다른 경로로 설정 변경 시 동기화
window.copyManager.onSettingsChanged((s) => applySettings(s))

/**
 * 창이 다시 활성화되면 바로 검색을 이어갈 수 있게 한다.
 * 단, 모달·우클릭 메뉴는 현재 조작을 보존해야 하므로 검색창으로 포커스를 빼앗지 않는다.
 */
function focusSearchWhenSafe(): void {
  if (document.querySelector<HTMLElement>('.overlay.show') || ctxEl.classList.contains('show')) return
  window.requestAnimationFrame(() => {
    if (document.querySelector<HTMLElement>('.overlay.show') || ctxEl.classList.contains('show')) return
    isResultNavigation = false
    searchEl.focus({ preventScroll: true })
  })
}

window.copyManager.onWindowFocused(focusSearchWhenSafe)
// main 이벤트가 렌더러 구독보다 먼저 발생한 초기 표시 경로의 보완책이다.
window.addEventListener('focus', focusSearchWhenSafe)

async function initSettings(): Promise<void> {
  applySettings(await window.copyManager.getSettings())
}

async function initAppInfo(): Promise<void> {
  const { title } = await window.copyManager.getAppInfo()
  appTitleEl.textContent = title
  document.title = title
}

void reload()
void initSettings()
void initAppInfo()
