import { contextBridge, ipcRenderer } from 'electron'
import type { ClipItem } from '../shared/clipboard-store'
import type { AppSettings } from '../shared/settings'

// 보안: contextIsolation on 전제. 렌더러에 최소 API 표면만 노출.
const api = {
  /** 클립보드 히스토리 조회 */
  getHistory: (): Promise<readonly ClipItem[]> => ipcRenderer.invoke('history:get'),
  /** 창 핀(자동숨김 고정) 토글 — D5 */
  setPinned: (pinned: boolean): void => ipcRenderer.send('pin:set', pinned),
  /** 클릭=복사: 항목을 OS 클립보드에 쓰기(창 유지) */
  copy: (id: string): Promise<boolean> => ipcRenderer.invoke('clip:copy', id),
  /** Enter/더블클릭=붙여넣기: 클립보드에 쓴 뒤 직전 앱에 Ctrl+V */
  paste: (id: string): Promise<boolean> => ipcRenderer.invoke('clip:paste', id),
  /** 항목 핀 토글(카드 📌/우클릭/상세) — D7/D13 */
  pinItem: (id: string, pinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke('item:pin', { id, pinned }),
  /** 항목 삭제 — D13/D15 */
  deleteItem: (id: string): Promise<boolean> => ipcRenderer.invoke('clip:delete', id),
  /** 모두 지우기(핀 제외) — D15 */
  clearUnpinned: (): Promise<boolean> => ipcRenderer.invoke('clip:clear'),
  /** 메모리 리셋(핀 포함 전체) — D15/D17 */
  resetMemory: (): Promise<boolean> => ipcRenderer.invoke('clip:reset'),
  /** 설정 조회 — D17 */
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  /** 설정 변경(부분 갱신). 갱신된 전체 설정 반환 — D17 */
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  /** 새 항목 적재 등 히스토리 변경 알림 구독 */
  onHistoryChanged: (cb: () => void): void => {
    ipcRenderer.on('history:changed', () => cb())
  },
  /** 설정 변경 알림 구독(다른 경로로 변경 시 동기화) */
  onSettingsChanged: (cb: (s: AppSettings) => void): void => {
    ipcRenderer.on('settings:changed', (_e, s: AppSettings) => cb(s))
  }
}

export type CopyManagerApi = typeof api

contextBridge.exposeInMainWorld('copyManager', api)
