import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

// S5 — 앱 설정 저장소 (느슨 결합 — electron 무관, JSON 영속).
// D17: 핫키·카드 수·유지 개수·리모컨(투명도·드웰·속도·모드) + 재부팅 시 기본값 리셋.
// 렌더러는 이 파일에서 타입만 `import type` 으로 가져온다(런타임 node:fs 미번들).

export type RemoteMode = 'dwell' | 'click'
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
  /** 현재 화면 작업 영역 안의 9분할 창 배치 */
  windowPlacement: WindowPlacement
  /** 사용자가 헤더를 드래그해 옮긴 실제 창 좌표. 없으면 9분할 배치값을 사용한다. */
  windowPosition: WindowPosition | null
  /** 비핀 히스토리 유지 개수 (D7) */
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Alt+V',
  cols: 3,
  uiScale: 1,
  windowPlacement: 'center',
  windowPosition: null,
  keepCount: 50,
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
  launchAtStartup: false
}

interface SettingsPersist {
  version: 1
  settings: AppSettings
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
    this.data = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
  }

  /** 현재 설정을 JSON 파일로 저장(디렉토리 없으면 생성). */
  async save(): Promise<void> {
    const payload: SettingsPersist = { version: 1, settings: this.data }
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }
}
