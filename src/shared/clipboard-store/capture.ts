import type { ClipItem, ClipType } from './types'
import type { ClipboardStore } from './store'
import { classifyText } from './classify'

/**
 * 클립보드 읽기 추상화 — electron 의 clipboard 를 직접 의존하지 않기 위한 포트.
 * main 프로세스가 electron clipboard 로 구현해 주입하고,
 * 테스트는 fake 구현을 주입한다(느슨 결합).
 */
export interface ClipboardReader {
  readText(): string
  /** 이미지가 있으면 dataURL, 없으면 null */
  readImageDataUrl(): string | null
}

/**
 * 클립보드를 한 번 읽어 store 에 적재한다.
 * - 직전 항목과 동일 내용이면 아무것도 하지 않음(폴링 노이즈 방지)
 * - 히스토리 어딘가에 같은 내용이 이미 있으면 새 카드 대신 그 항목을 맨 앞으로 승격(D34)
 * - 적재 또는 승격했으면 ClipItem 반환, 변화가 없으면 null
 */
export function captureOnce(
  reader: ClipboardReader,
  store: ClipboardStore,
  shouldSkipCapture?: (type: ClipItem['type'], content: string) => boolean
): ClipItem | null {
  const image = reader.readImageDataUrl()
  if (image) {
    if (shouldSkipCapture?.('image', image)) return null
    return addOrPromote(store, 'image', image)
  }

  const text = reader.readText()
  if (text.trim().length > 0) {
    const type = classifyText(text)
    if (shouldSkipCapture?.(type, text)) return null
    return addOrPromote(store, type, text)
  }

  return null
}

/**
 * 중복 카드를 만들지 않고 적재한다(D34).
 * 앱 안에서 기존 카드를 복사한 경우와 다른 앱에서 같은 내용을 다시 복사한 경우 모두,
 * 기존 항목이 맨 앞으로 올라올 뿐 히스토리 개수는 늘지 않는다.
 */
function addOrPromote(store: ClipboardStore, type: ClipType, content: string): ClipItem | null {
  const last = store.latest()
  if (last && last.type === type && last.content === content) return null
  const existing = store.findLatestByContent(type, content)
  if (existing) return store.promote(existing.id) ?? null
  return store.add({ type, content })
}
