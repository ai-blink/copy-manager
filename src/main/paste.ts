import { keyboard, Key } from '@nut-tree-fork/nut-js'

// S3e: 직전 포커스 앱에 Ctrl+V 키 입력을 합성한다(붙여넣기).
// nut.js(@nut-tree-fork/nut-js)는 네이티브 입력 합성 → 헤드리스 검증 불가(MANUAL-SMOKE).

// 키 입력 사이 간격. 0이면 OS 가 조합키(Ctrl+V)를 놓칠 수 있어 약간의 텀을 둔다.
keyboard.config.autoDelayMs = 40

export async function sendCtrlV(): Promise<void> {
  // 한 번에 누르지 않고 Ctrl↓ → V↓ → V↑ → Ctrl↑ 순서로 보내 OS 가 조합을 정확히 인식하게 한다.
  await keyboard.pressKey(Key.LeftControl)
  await keyboard.pressKey(Key.V)
  await keyboard.releaseKey(Key.V)
  await keyboard.releaseKey(Key.LeftControl)
}
