import { defineConfig } from 'vitest/config'

// store 단위테스트(node 환경). clipboard-store는 electron 무관 모듈이라
// vitest에서 그대로 import 가능(느슨 결합의 핵심).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
