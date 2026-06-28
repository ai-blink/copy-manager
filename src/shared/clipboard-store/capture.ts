import type { ClipItem } from './types'
import type { ClipboardStore } from './store'

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
 * - 직전 항목과 동일 내용이면 중복 적재하지 않음(폴링 노이즈 방지)
 * - 새로 적재했으면 ClipItem 반환, 아니면 null
 */
export function captureOnce(reader: ClipboardReader, store: ClipboardStore): ClipItem | null {
  const image = reader.readImageDataUrl()
  if (image) {
    const last = store.latest()
    if (last && last.type === 'image' && last.content === image) return null
    return store.add({ type: 'image', content: image })
  }

  const text = reader.readText()
  if (text.trim().length > 0) {
    const last = store.latest()
    if (last && last.content === text) return null
    return store.add({ content: text }) // type 은 classifyText 가 자동 결정
  }

  return null
}
