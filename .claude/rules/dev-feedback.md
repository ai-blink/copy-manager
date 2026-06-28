---
description: 반복 실수 패턴 + 프로젝트 운영 원칙. Stop hook dev-docs-enforcer 필수 파일.
updated: 2026-06-28
---

# dev-feedback — copy-manager

## 운영 원칙
- **셸**: PowerShell 도구 우선(도스창 깜빡임 방지). Bash는 Unix 전용 명령 필요 시만.
- **코드 변경 게이트**: Write/Edit/Bash 코드 변경 전 "대상·변경·영향 1~2문장 + 승인". 탐색(Read/Glob/Grep)은 자유.
- **비가역 동작은 확인 모달**(D15): 항목 삭제·모두 지우기·메모리 리셋은 반드시 확인 경유.
- **백업은 git**: `.bak`·`복사본` 금지. 복원은 history.
- **결정·계획은 문서로**: 대화에만 두지 말고 `.claude/rules/dev-*.md`에 반영.
- **느슨 결합 유지**: `clipboard-store`·`scroll-remote`·`settings`는 electron 비의존(테스트 가능·전역판 분리 대비, D18/D25).

## 재발 방지 패턴 (recurring-mistakes)
- **Electron 좀비 누적** — dev 다회 재시작 시 electron 프로세스가 쌓여 포트/핫키 선점·캐시 충돌.
  → dev 재시작 전 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`
- **붙여넣기 합성(Windows 포그라운드 락)** — focus만 복원하면 Ctrl+V 미입력.
  → `getActiveWindow` 저장 → `focus()` 복원 → delay → `Ctrl↓V↓V↑Ctrl↑` **순차**(autoDelayMs 40). 동시누름+0ms는 실패(D23).
- **vite8 ↔ electron-vite5 peer 충돌** — nut.js 설치 시 ERESOLVE.
  → vite는 `^7`로 고정(electron-vite5 peer ^5-7). 이때 main 출력 mjs→js(CJS), `package.json main`도 `index.js`(D19).
- **Electron 기동 실패 2종**:
  ① `Error: Electron uninstall` → 바이너리 미설치 → `node node_modules/electron/install.js`(약 232MB).
  ② `Electron failed to install correctly` → main 번들에 electron 인라인 → `externalizeDepsPlugin()` + `external:['electron']`(D19).
- **렌더러 번들에 node:fs 누출 금지** — shared 모듈(`clipboard-store`·`settings`)은 렌더러에서 **`import type`만** 사용(런타임 import 0). 빌드 후 renderer 모듈 수로 확인.
- **preload는 CJS(.cjs)** — Electron sandbox는 ESM preload 미지원(D19).
- **프레임리스 창이 안 움직임** — `frame:false` 창은 OS 드래그 영역이 없으면 마우스로 이동 불가.
  → 타이틀바(`.head`)에 `-webkit-app-region: drag`, 그 안의 버튼/입력(`.hbtn` 등)엔 `-webkit-app-region: no-drag`(클릭 유지). 더블클릭=최대화 부작용 가능.
