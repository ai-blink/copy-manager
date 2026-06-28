// clipboard-store 공용 타입.
// 이 모듈은 electron 에 의존하지 않는다(향후 별도 패키지 분리 대비 느슨 결합).

export type ClipType = 'text' | 'image' | 'link' | 'code'

export interface ClipItem {
  /** 안정적 고유 id (`${createdAt}-${seq}`) */
  id: string
  type: ClipType
  /** text/link/code = 원문, image = dataURL */
  content: string
  /** 핀 항목은 ring buffer 카운트에서 제외되고 절대 축출되지 않음 (D7) */
  pinned: boolean
  /** epoch millis */
  createdAt: number
}

/** store.add() 입력. type 미지정 시 내용으로 자동 분류, createdAt 미지정 시 현재 시각. */
export interface AddInput {
  content: string
  type?: ClipType
  pinned?: boolean
  createdAt?: number
}

/** 디스크 영속화 스키마(JSON). */
export interface PersistShape {
  version: 1
  items: ClipItem[]
}
