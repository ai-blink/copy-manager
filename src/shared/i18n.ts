// i18n — UI 문자열 사전. electron/node 의존 없이 순수 데이터+함수만 두어
// main·renderer 양쪽에서 런타임으로 import 해도 안전하다(settings/index.ts 의 node:fs 와 다름).

export type Lang = 'en' | 'ko'
export type LanguagePref = 'system' | Lang

/** IPC 로 넘어가는 설정에 붙는 현재 표시 언어. 저장 대상 아님(main 이 매번 다시 계산). */
export type WithResolvedLanguage<T> = T & { resolvedLanguage: Lang }

/** 설정값(language)과 OS 로케일로 실제 표시 언어를 정한다. 한국어 로케일이 아니면 영어. */
export function resolveLang(pref: LanguagePref, systemLocale: string): Lang {
  if (pref === 'en' || pref === 'ko') return pref
  return systemLocale.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

const en = {
  appName: 'Clipboard',
  appMode: { packaged: 'Packaged', dev: 'Development' },
  windowTitle: 'Clipboard v{version} · {mode}',
  header: {
    pinOn: 'Always on top — click to turn off',
    pinOff: 'Always on top — click to turn on',
    dedupe: 'Remove duplicates (keeps pins)',
    clearAll: 'Clear all (except pins)',
    settings: 'Settings',
    close: 'Close (also closes with Ctrl+Alt+V)'
  },
  type: { text: 'Text', image: 'Image', link: 'Link', code: 'Code' },
  tabs: { all: 'All' },
  search: {
    placeholder: 'Search or type to filter…',
    countHint: 'Current search results / max kept'
  },
  countFormat: { shown: '{shown} / {max}' },
  empty: { noHistory: 'Clipboard is empty', noResults: 'No items match' },
  foot: { navigate: 'Navigate', clickKey: 'Click', copy: 'Copy', paste: 'Paste' },
  toast: { copied: '✓ Copied — "{content}"', imageCopied: '✓ Image copied' },
  timeAgo: { justNow: 'Just now', minutes: '{n}m ago', hours: '{n}h ago', days: '{n}d ago' },
  state: {
    total: '{n} total',
    dedupedRemoved: '{n} duplicates removed',
    dedupedNone: 'No duplicates found'
  },
  card: { pin: 'Pin', unpin: 'Unpin', detail: 'View details', delete: 'Delete' },
  ctxMenu: { copy: 'Copy', paste: 'Paste', detail: 'View details', delete: 'Delete' },
  detail: {
    title: 'Details',
    close: 'Close',
    pin: '📌 Pin',
    delete: '🗑️ Delete',
    paste: 'Paste'
  },
  confirmDefaults: { title: 'Confirm', cancel: 'Cancel' },
  noticeDefaults: { title: 'Notice', ok: 'OK' },
  confirmDelete: { title: 'Delete item', msg: 'Delete this item?', yes: 'Delete' },
  confirmClearAll: {
    title: 'Clear all',
    msg: 'Clear all history except pinned items?',
    yes: 'Clear all'
  },
  confirmDedupe: {
    title: 'Remove duplicates',
    msg: 'Keep only the newest of each duplicate (same content/type) and remove the rest? Pinned items are kept.',
    yes: 'Remove duplicates'
  },
  confirmMemReset: {
    title: 'Reset memory',
    msg: 'Delete all clipboard history (including pins)? This cannot be undone.',
    yes: 'Delete all'
  },
  hotkeyConflict: {
    title: 'Hotkey unavailable',
    msg: 'This hotkey is already used by Windows or another app. The previous hotkey is kept.'
  },
  settingsModal: {
    title: 'Settings',
    done: 'Done',
    sidebarLabel: 'Settings categories',
    tabs: {
      general: 'General',
      display: 'Window/Display',
      history: 'History',
      remote: 'Remote',
      security: 'Security'
    },
    general: {
      hotkeyLabel: 'Global hotkey (open window)',
      hotkeyMod1: 'First modifier',
      hotkeyMod2: 'Second modifier',
      hotkeyKey: 'Key',
      hotkeyNone: 'None',
      hotkeyNotePrefix: 'Selected hotkey:',
      hotkeyNoteSuffix: '. win+v is reserved by the OS, so the app uses its own hotkey.',
      keepOpen: 'Keep window open (don’t close on focus loss)',
      keepOpenNote:
        'Uncheck to auto-close when clicking elsewhere (auto-hide). Use the header ✕ button to close explicitly.',
      launchAtStartup: 'Launch at Windows startup',
      launchAtStartupNote:
        'When on, the app launches automatically at Windows login. Only applies to the packaged app.',
      rebootReset: 'Reset settings to defaults on restart',
      rebootResetNote: 'When checked, experimental changes revert to defaults on the next launch.',
      quitLabel: 'Quit app',
      quitBtn: 'Quit app',
      quitNote:
        'Alt+F4 and the header ✕ only hide the window. Use this only to fully stop clipboard monitoring.',
      languageLabel: 'Language',
      languageSystem: 'Match system',
      languageKo: '한국어',
      languageEn: 'English',
      languageNote: '"Match system" follows your OS display language.'
    },
    display: {
      themeLabel: 'App theme',
      themeDark: 'Dark mode',
      themeLight: 'Light mode',
      themeNote: 'The selected mode applies immediately to the whole app and the copy toast.',
      colsLabel: 'Cards per row',
      uiScaleLabel: 'Overall UI scale',
      uiScaleNote: 'Scales the whole app 75–150% without changing the window size.',
      placementLabel: 'Window placement',
      placement: {
        topLeft: 'Top-left',
        top: 'Top',
        topRight: 'Top-right',
        left: 'Left',
        center: 'Center',
        right: 'Right',
        bottomLeft: 'Bottom-left',
        bottom: 'Bottom',
        bottomRight: 'Bottom-right'
      },
      placementNote: 'Moves the window immediately within the current monitor’s work area.',
      toastThemeLabel: 'Copy toast color',
      toastTheme: { dark: 'Dark', accent: 'Purple', mint: 'Mint', black: 'Deep black' },
      toastOpacity: 'Opacity',
      toastFontSize: 'Font size',
      toastPadY: 'Vertical padding',
      toastPadX: 'Horizontal padding',
      toastPreview: '✓ Copied — "A preview of what you copied shows here, up to 3 lines"',
      toastNote:
        'The toast that briefly appears at the bottom when you copy a card. In light mode, the background is corrected to a minimum opacity of 0.76 for white-text contrast.'
    },
    history: {
      keepCountLabel: 'History size',
      keepCountNote:
        'Type a value from 1–1000 or pick a quick preset. Pinned items don’t count toward the limit, and the oldest unpinned items are trimmed first when you lower it.',
      dupLabel: 'Duplicate entries',
      dupBtn: '♻ Remove duplicates',
      dupNote:
        'Keeps only the newest of each unpinned entry with the same content/type. Pinned entries are kept.',
      memLabel: 'Memory',
      memBtn: '🧹 Reset memory (delete all history)',
      memNote: 'Empties the entire clipboard history (including pins). This cannot be undone.'
    },
    remote: {
      enable: 'Use scroll remote',
      enableNote:
        'When off, the ▲▼ scroll remote inside the window disappears. Mouse wheel/keyboard navigation still works.',
      opacity: 'Remote idle opacity',
      dwell: 'Dwell threshold',
      speed: 'Scroll speed',
      modeLabel: 'Activation mode',
      modeDwell: 'Dwell',
      modeClick: 'Click/hold'
    },
    security: {
      contentProtection: 'Screen capture protection (security)',
      contentProtectionNote:
        'When on, this window is excluded from screenshots, screen recording, and screen sharing. Turn it off only when you need to demo the window. Effects may vary on some remote desktop (RDP) setups.'
    }
  },
  remote: { drag: 'Drag to move', settings: 'Remote settings' }
} as const

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
type Dict = Widen<typeof en>

const ko: Dict = {
  appName: '클립보드',
  appMode: { packaged: '패키지 실행', dev: '개발 실행' },
  windowTitle: '클립보드 v{version} · {mode}',
  header: {
    pinOn: '항상 위 켜짐 — 클릭하면 해제',
    pinOff: '항상 위 꺼짐 — 클릭하면 켜기',
    dedupe: '중복 기록 제거(핀 유지)',
    clearAll: '모두 지우기(핀 제외)',
    settings: '설정',
    close: '닫기 (Ctrl+Alt+V 다시 눌러도 닫힘)'
  },
  type: { text: '텍스트', image: '이미지', link: '링크', code: '코드' },
  tabs: { all: '전체' },
  search: {
    placeholder: '검색하거나 입력해서 필터…',
    countHint: '현재 검색 결과 / 최대 보유 개수'
  },
  countFormat: { shown: '{shown} / {max}개' },
  empty: { noHistory: '클립보드가 비어 있어요', noResults: '조건에 맞는 항목이 없어요' },
  foot: { navigate: '탐색', clickKey: '클릭', copy: '복사', paste: '붙여넣기' },
  toast: { copied: '✓ 복사됨 — "{content}"', imageCopied: '✓ 이미지 복사됨' },
  timeAgo: { justNow: '방금', minutes: '{n}분 전', hours: '{n}시간 전', days: '{n}일 전' },
  state: {
    total: '총 {n}개',
    dedupedRemoved: '중복 {n}개 제거됨',
    dedupedNone: '중복 기록 없음'
  },
  card: { pin: '핀 고정', unpin: '핀 해제', detail: '상세 보기', delete: '삭제' },
  ctxMenu: { copy: '복사', paste: '붙여넣기', detail: '상세 보기', delete: '삭제' },
  detail: {
    title: '상세 보기',
    close: '닫기',
    pin: '📌 핀',
    delete: '🗑️ 삭제',
    paste: '붙여넣기'
  },
  confirmDefaults: { title: '확인', cancel: '취소' },
  noticeDefaults: { title: '알림', ok: '확인' },
  confirmDelete: { title: '항목 삭제', msg: '이 항목을 삭제할까요?', yes: '삭제' },
  confirmClearAll: {
    title: '모두 지우기',
    msg: '핀을 제외한 모든 기록을 지울까요?',
    yes: '모두 지우기'
  },
  confirmDedupe: {
    title: '중복 기록 제거',
    msg: '같은 내용·유형의 비핀 기록은 최신 1개만 남기고 지울까요? 핀 기록은 유지됩니다.',
    yes: '중복 제거'
  },
  confirmMemReset: {
    title: '메모리 리셋',
    msg: '모든 클립보드 기록을 삭제할까요? (핀 포함, 되돌릴 수 없음)',
    yes: '전체 삭제'
  },
  hotkeyConflict: {
    title: '단축키를 사용할 수 없음',
    msg: '이 단축키는 Windows 또는 다른 앱에서 이미 사용 중입니다. 기존 단축키는 그대로 유지됩니다.'
  },
  settingsModal: {
    title: '설정',
    done: '완료',
    sidebarLabel: '설정 분류',
    tabs: {
      general: '일반',
      display: '창·표시',
      history: '히스토리',
      remote: '리모컨',
      security: '보안'
    },
    general: {
      hotkeyLabel: '전역 단축키 (창 열기)',
      hotkeyMod1: '첫 보조키',
      hotkeyMod2: '두 번째 보조키',
      hotkeyKey: '실행 키',
      hotkeyNone: '없음',
      hotkeyNotePrefix: '선택한 단축키:',
      hotkeyNoteSuffix: '. win+v는 OS 예약이라 자체 핫키를 씁니다.',
      keepOpen: '창 유지 (포커스를 잃어도 닫지 않음)',
      keepOpenNote:
        '체크 해제하면 다른 곳을 클릭할 때 자동으로 닫힙니다(자동숨김). 닫기는 헤더 ✕ 버튼으로 합니다.',
      launchAtStartup: '윈도우 시작 시 자동 실행',
      launchAtStartupNote:
        '켜면 Windows 로그인 시 이 앱이 자동으로 실행됩니다. 패키징된 앱에서만 적용됩니다.',
      rebootReset: '재부팅(앱 재시작) 시 설정을 기본값으로 리셋',
      rebootResetNote: '체크하면 실험적으로 바꾼 값도 다음 실행 때 기본값으로 돌아옵니다.',
      quitLabel: '앱 종료',
      quitBtn: '앱 종료',
      quitNote: 'Alt+F4와 헤더 ✕는 창만 숨깁니다. 클립보드 감시를 완전히 끝낼 때만 사용하세요.',
      languageLabel: '언어',
      languageSystem: '시스템 자동',
      languageKo: '한국어',
      languageEn: 'English',
      languageNote: '시스템 자동은 OS 표시 언어를 따릅니다.'
    },
    display: {
      themeLabel: '앱 테마',
      themeDark: '다크 모드',
      themeLight: '라이트 모드',
      themeNote: '선택한 모드는 즉시 전체 화면과 복사 알림에 적용됩니다.',
      colsLabel: '한 줄 카드 수',
      uiScaleLabel: '전체 UI 배율',
      uiScaleNote: '창 크기는 그대로 두고 앱 전체를 75~150%로 확대·축소합니다.',
      placementLabel: '창 배치',
      placement: {
        topLeft: '좌상',
        top: '상단',
        topRight: '우상',
        left: '좌',
        center: '중앙',
        right: '우',
        bottomLeft: '좌하',
        bottom: '하단',
        bottomRight: '우하'
      },
      placementNote: '현재 창이 있는 모니터의 작업 영역 안에서 즉시 이동합니다.',
      toastThemeLabel: '복사 알림 배색',
      toastTheme: { dark: '다크', accent: '보라', mint: '민트', black: '딥블랙' },
      toastOpacity: '불투명도',
      toastFontSize: '글자 크기',
      toastPadY: '세로 여백',
      toastPadX: '가로 여백',
      toastPreview: '✓ 복사됨 — "여기에 복사한 내용이 최대 3줄까지 보입니다"',
      toastNote:
        '카드를 복사하면 창 아래에 잠깐 뜨는 알림입니다. 라이트 모드에서는 흰색 글자 대비를 위해 알림 배경을 최소 0.76 불투명도로 보정합니다.'
    },
    history: {
      keepCountLabel: '히스토리 유지 개수',
      keepCountNote:
        '1~1000개를 직접 입력하거나 빠른 값을 선택하세요. 핀 항목은 카운트에서 제외되고, 개수를 줄이면 가장 오래된 비핀 기록부터 정리됩니다.',
      dupLabel: '중복 기록',
      dupBtn: '♻ 중복 기록 제거',
      dupNote: '같은 내용·유형의 비핀 기록은 최신 1개만 남기고 정리합니다. 핀 기록은 유지됩니다.',
      memLabel: '메모리',
      memBtn: '🧹 메모리 리셋 (모든 기록 삭제)',
      memNote: '클립보드 히스토리를 전부 비웁니다(핀 포함). 되돌릴 수 없습니다.'
    },
    remote: {
      enable: '스크롤 리모컨 사용',
      enableNote: '끄면 창 안의 ▲▼ 스크롤 리모컨이 사라집니다. 마우스 휠·키보드 탐색은 그대로 동작합니다.',
      opacity: '리모컨 평소 투명도',
      dwell: '드웰 임계 시간',
      speed: '스크롤 속도',
      modeLabel: '활성화 방식',
      modeDwell: '드웰',
      modeClick: '클릭/홀드'
    },
    security: {
      contentProtection: '화면 캡처 방지 (보안)',
      contentProtectionNote:
        '켜면 스크린샷·화면 녹화·화면 공유에 이 창이 잡히지 않습니다. 데모로 창을 보여줘야 할 때만 해제하세요. 일부 원격 데스크톱(RDP)에서는 효과가 다를 수 있습니다.'
    }
  },
  remote: { drag: '드래그로 이동', settings: '리모컨 설정' }
}

const DICTS: Record<Lang, Dict> = { en, ko }

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeyOf<T[K]>}`
}[keyof T & string]

export type I18nKey = NestedKeyOf<Dict>

function lookup(dict: Dict, path: string): string | undefined {
  const value: unknown = path
    .split('.')
    .reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict)
  return typeof value === 'string' ? value : undefined
}

/** 사전 값 조회 + `{var}` 치환. 언어에 값이 없으면 영어로, 그마저 없으면 key 자체로 폴백. */
export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key) ?? key
  if (!vars) return raw
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), raw)
}
