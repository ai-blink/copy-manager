import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

// S5 — 앱 설정 저장소 (느슨 결합 — electron 무관, JSON 영속).
// D17: 핫키·카드 수·유지 개수·리모컨(투명도·드웰·속도·모드) + 재부팅 시 기본값 리셋.
// 렌더러는 이 파일에서 타입만 `import type` 으로 가져온다(런타임 node:fs 미번들).

export type RemoteMode = 'dwell' | 'click'

export interface AppSettings {
  /** 전역 핫키(Electron accelerator) */
  hotkey: string
  /** 한 줄 카드 수 (2~5, D4) */
  cols: number
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
  /** 재부팅(앱 재시작) 시 설정을 기본값으로 리셋 (D17) */
  rebootReset: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+V',
  cols: 3,
  keepCount: 50,
  remoteOpacity: 0.65,
  dwellMs: 700,
  scrollSpeed: 6,
  remoteMode: 'dwell',
  rebootReset: false
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
    return { ...this.data }
  }

  /** 일부 키만 갱신(나머지 유지). 갱신된 전체 설정 반환. */
  set(patch: Partial<AppSettings>): AppSettings {
    this.data = { ...this.data, ...patch }
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
