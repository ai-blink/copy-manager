import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

// S1/S2 스캐폴딩: main / preload / renderer 3-타깃 빌드.
// 렌더러는 창이 뜨는 최소 스텁만(카드 그리드는 S3 범위라 만들지 않음).
export default defineConfig({
  main: {
    // electron 및 node builtin 을 번들하지 않고 external 처리(런타임 내장 모듈 사용).
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['electron'],
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        external: ['electron'],
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // sandboxed preload 는 ESM 미지원 → CJS(.cjs)로 빌드(sandbox:true 유지).
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
