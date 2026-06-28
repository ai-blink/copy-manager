// clipboard-store 공개 표면 — 향후 별도 패키지로 떼어내기 쉽게 단일 진입점 유지.
export type { ClipType, ClipItem, AddInput, PersistShape } from './types'
export { classifyText } from './classify'
export { ClipboardStore, IDENTITY_CIPHER } from './store'
export type { ClipboardStoreOptions, Cipher } from './store'
export { captureOnce } from './capture'
export type { ClipboardReader } from './capture'
