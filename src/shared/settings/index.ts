import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { LanguagePref } from '../i18n'

// S5 — 앱 설정 저장소 (느슨 결합 — electron 무관, JSON 영속).
// D17: 핫키·카드 수·유지 개수·리모컨(투명도·드웰·속도·모드) + 재부팅 시 기본값 리셋.
// 렌더러는 이 파일에서 타입만 `import type` 으로 가져온다(런타임 node:fs 미번들).

export type RemoteMode = 'dwell' | 'click'
export const MIN_KEEP_COUNT = 1
export const MAX_KEEP_COUNT = 1000

/** 앱 전역 색상 모드. OS 설정을 따르지 않고 사용자가 명시적으로 고른 값을 저장한다. */
export type AppTheme = 'dark' | 'light'
export const APP_THEMES: readonly AppTheme[] = ['dark', 'light']

/** UI 표시 언어. 'system'이면 OS 로케일로 자동 판정(shared/i18n resolveLang). */
export const LANGUAGE_PREFS: readonly LanguagePref[] = ['system', 'en', 'ko']

/** 복사 토스트 배색(D34). 후보 비교에서 고른 4종. */
export type ToastTheme = 'dark' | 'accent' | 'mint' | 'black'
export const TOAST_THEMES: readonly ToastTheme[] = ['dark', 'accent', 'mint', 'black']

/**
 * 토스트 수치 설정의 허용 범위. 렌더러 슬라이더도 이 값을 쓰므로 최소/최대가 한 곳에만 있다.
 */
export const TOAST_LIMITS = {
  opacity: { min: 0.25, max: 1 },
  fontSize: { min: 11, max: 17 },
  padY: { min: 6, max: 16 },
  padX: { min: 10, max: 28 }
} as const
export type WindowPlacement =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'
export interface WindowPosition {
  x: number
  y: number
}

export interface AppSettings {
  /** 전역 핫키(Electron accelerator) */
  hotkey: string
  /** 한 줄 카드 수 (2~8, D32) */
  cols: number
  /** 전체 UI 배율. Electron 렌더러 zoom factor (0.75~1.5) */
  uiScale: number
  /** 앱 전역 색상 모드. 토스트의 대비 보정에도 사용한다. */
  appTheme: AppTheme
  /** 현재 화면 작업 영역 안의 9분할 창 배치 */
  windowPlacement: WindowPlacement
  /** 사용자가 헤더를 드래그해 옮긴 실제 창 좌표. 없으면 9분할 배치값을 사용한다. */
  windowPosition: WindowPosition | null
  /** 비핀 히스토리 유지 개수 (1~1000, D7) */
  keepCount: number
  /** 리모컨 평소 투명도 0~1 (D10) */
  remoteOpacity: number
  /** 드웰 임계 시간(ms) (D9) */
  dwellMs: number
  /** 리모컨 스크롤 속도(프레임당 px) */
  scrollSpeed: number
  /** 리모컨 활성화 방식 (D9) */
  remoteMode: RemoteMode
  /** 스크롤 리모컨(창 내부 ▲▼ 플로팅) 표시 여부 on/off (D31, 기본 false) */
  remoteEnabled: boolean
  /** 창 유지: true 면 포커스를 잃어도 안 닫힘. false 면 blur→자동숨김 (D5 갱신) */
  keepOpen: boolean
  /** 항상 위: true 면 다른 창 위에 표시. 헤더 📌 토글값을 재호출·재시작 뒤에도 유지 */
  alwaysOnTop: boolean
  /** 재부팅(앱 재시작) 시 설정을 기본값으로 리셋 (D17) */
  rebootReset: boolean
  /** 화면 캡처 방지: true 면 스크린샷/녹화/화면공유에서 창 제외 (보안, D28) */
  contentProtection: boolean
  /** 윈도우 시작(로그인) 시 앱 자동 실행 (D30). 패키징된 앱에서 정상 동작 */
  launchAtStartup: boolean
  /** 복사 토스트 배색 (D34) */
  toastTheme: ToastTheme
  /** 토스트 배경 불투명도 0.25~1 (낮을수록 뒤 카드가 비친다, D34) */
  toastOpacity: number
  /** 토스트 글자 크기 px (11~17) */
  toastFontSize: number
  /** 토스트 세로 여백 px (6~16) */
  toastPadY: number
  /** 토스트 가로 여백 px (10~28) */
  toastPadX: number
  /** UI 표시 언어. 'system'이면 OS 로케일로 자동 판정한다(기본값). */
  language: LanguagePref
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Alt+V',
  cols: 3,
  uiScale: 1,
  appTheme: 'dark',
  windowPlacement: 'center',
  windowPosition: null,
  keepCount: 100,
  remoteOpacity: 0.65,
  dwellMs: 700,
  scrollSpeed: 6,
  remoteMode: 'dwell',
  // D31: 스크롤 리모컨은 옵트인(기본 꺼짐) — 키보드/휠 탐색으로 충분한 사용자를 위해.
  remoteEnabled: false,
  keepOpen: true,
  alwaysOnTop: true,
  rebootReset: false,
  // 보안 우선 기본값(D28): 민감 클립보드 내용이 화면 공유/녹화에 새지 않도록 기본 활성.
  contentProtection: true,
  // D30: 자동 실행은 사용자가 명시적으로 켜야 하는 옵트인(기본 꺼짐).
  launchAtStartup: false,
  // D34: 후보 비교에서 사용자가 고른 기본값(보라 액센트 + 투명도 0.31).
  toastTheme: 'accent',
  toastOpacity: 0.31,
  toastFontSize: 13,
  toastPadY: 10,
  toastPadX: 18,
  // 새 프로필은 OS 언어를 따른다. 명시적으로 고른 언어는 이후 그대로 유지된다.
  language: 'system'
}

interface SettingsPersist {
  version: number
  settings: AppSettings
}

function normalizeKeepCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(MAX_KEEP_COUNT, Math.max(MIN_KEEP_COUNT, Math.floor(value)))
}

/** 범위를 벗어난 값·잘못된 타입은 fallback 으로 되돌린다(손상된 설정 파일 방어). */
function clampNumber(
  value: unknown,
  fallback: number,
  { min, max }: { min: number; max: number },
  round: (n: number) => number = Math.round
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, round(value)))
}

const roundHundredth = (n: number): number => Math.round(n * 100) / 100

function normalizeToastTheme(value: unknown, fallback: ToastTheme): ToastTheme {
  return TOAST_THEMES.includes(value as ToastTheme) ? (value as ToastTheme) : fallback
}

function normalizeAppTheme(value: unknown, fallback: AppTheme): AppTheme {
  return APP_THEMES.includes(value as AppTheme) ? (value as AppTheme) : fallback
}

function normalizeLanguage(value: unknown, fallback: LanguagePref): LanguagePref {
  return LANGUAGE_PREFS.includes(value as LanguagePref) ? (value as LanguagePref) : fallback
}

/** 토스트 관련 값만 보정해 반환 — set()/load() 양쪽에서 같은 규칙을 쓴다. */
function normalizeToast(
  source: Partial<AppSettings>,
  base: Pick<
    AppSettings,
    'toastTheme' | 'toastOpacity' | 'toastFontSize' | 'toastPadY' | 'toastPadX'
  >
): Pick<AppSettings, 'toastTheme' | 'toastOpacity' | 'toastFontSize' | 'toastPadY' | 'toastPadX'> {
  return {
    toastTheme: normalizeToastTheme(source.toastTheme, base.toastTheme),
    toastOpacity: clampNumber(
      source.toastOpacity,
      base.toastOpacity,
      TOAST_LIMITS.opacity,
      roundHundredth
    ),
    toastFontSize: clampNumber(source.toastFontSize, base.toastFontSize, TOAST_LIMITS.fontSize),
    toastPadY: clampNumber(source.toastPadY, base.toastPadY, TOAST_LIMITS.padY),
    toastPadX: clampNumber(source.toastPadX, base.toastPadX, TOAST_LIMITS.padX)
  }
}

export class SettingsStore {
  private data: AppSettings = { ...DEFAULT_SETTINGS }
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  /** 현재 설정의 불변 복사본. */
  get(): AppSettings {
    return {
      ...this.data,
      windowPosition: this.data.windowPosition ? { ...this.data.windowPosition } : null
    }
  }

  /** 일부 키만 갱신(나머지 유지). 갱신된 전체 설정 반환. */
  set(patch: Partial<AppSettings>): AppSettings {
    this.data = {
      ...this.data,
      ...patch,
      keepCount: normalizeKeepCount(patch.keepCount, this.data.keepCount),
      appTheme: normalizeAppTheme(patch.appTheme, this.data.appTheme),
      language: normalizeLanguage(patch.language, this.data.language),
      ...normalizeToast(patch, this.data),
      windowPosition:
        patch.windowPosition === undefined
          ? this.data.windowPosition
          : patch.windowPosition
            ? { ...patch.windowPosition }
            : null
    }
    return this.get()
  }

  /** 기본값으로 리셋. 단 rebootReset 플래그 자체는 유지(켜둔 채 재시작 시 계속 리셋되도록). */
  resetToDefaults(): AppSettings {
    this.data = { ...DEFAULT_SETTINGS, rebootReset: this.data.rebootReset }
    return this.get()
  }

  /** JSON 파일에서 재로딩. 파일 없으면 기본값. 누락 키는 기본값으로 보강(전방 호환). */
  async load(): Promise<void> {
    let raw: string
    try {
      raw = await fs.readFile(this.filePath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.data = { ...DEFAULT_SETTINGS }
        return
      }
      throw err
    }
    const parsed = JSON.parse(raw) as Partial<SettingsPersist>
    const persisted: Partial<AppSettings> = parsed.settings ?? {}
    // v1의 50은 이전 기본값이므로 새 기본값 100으로 한 번 마이그레이션한다.
    // 이후 저장 파일은 v2가 되어 사용자가 다시 고른 50은 그대로 유지된다.
    const migrateLegacyDefault = parsed.version === 1 && persisted.keepCount === 50
    const keepCount =
      migrateLegacyDefault
        ? DEFAULT_SETTINGS.keepCount
        : normalizeKeepCount(persisted.keepCount, DEFAULT_SETTINGS.keepCount)
    this.data = {
      ...DEFAULT_SETTINGS,
      ...persisted,
      keepCount,
      appTheme: normalizeAppTheme(persisted.appTheme, DEFAULT_SETTINGS.appTheme),
      language: normalizeLanguage(persisted.language, DEFAULT_SETTINGS.language),
      ...normalizeToast(persisted, DEFAULT_SETTINGS)
    }
    if (migrateLegacyDefault) await this.save()
  }

  /** 현재 설정을 JSON 파일로 저장(디렉토리 없으면 생성). */
  async save(): Promise<void> {
    const payload: SettingsPersist = { version: 3, settings: this.data }
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }
}
