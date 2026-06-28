import type { CopyManagerApi } from '../../preload'

// preload 가 contextBridge 로 노출한 API 의 렌더러 타입 선언.
declare global {
  interface Window {
    copyManager: CopyManagerApi
  }
}

export {}
