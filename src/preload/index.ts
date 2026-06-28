import { contextBridge, ipcRenderer } from 'electron'
import type { ClipItem } from '../shared/clipboard-store'

// 보안: contextIsolation on 전제. 렌더러에 최소 API 표면만 노출.
const api = {
  /** 클립보드 히스토리 조회 */
  getHistory: (): Promise<readonly ClipItem[]> => ipcRenderer.invoke('history:get'),
  /** 핀(자동숨김 고정) 토글 */
  setPinned: (pinned: boolean): void => ipcRenderer.send('pin:set', pinned),
  /** 클릭=복사: 항목을 OS 클립보드에 쓰기(창 유지) */
  copy: (id: string): Promise<boolean> => ipcRenderer.invoke('clip:copy', id),
  /** Enter/더블클릭=붙여넣기: 클립보드에 쓴 뒤 직전 앱에 Ctrl+V */
  paste: (id: string): Promise<boolean> => ipcRenderer.invoke('clip:paste', id),
  /** 새 항목 적재 등 히스토리 변경 알림 구독 */
  onHistoryChanged: (cb: () => void): void => {
    ipcRenderer.on('history:changed', () => cb())
  }
}

export type CopyManagerApi = typeof api

contextBridge.exposeInMainWorld('copyManager', api)
