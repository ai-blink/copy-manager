---
description: 반복 실수 패턴 + 프로젝트 운영 원칙. Stop hook dev-docs-enforcer 필수 파일.
updated: 2026-08-23
---

# dev-feedback — copy-manager

## 운영 원칙
- **셸**: PowerShell 도구 우선(도스창 깜빡임 방지). Bash는 Unix 전용 명령 필요 시만.
- **변경 게이트**: 파일을 수정·삭제하기 전 "대상·변경·영향 1~2문장 + 승인". 탐색은 자유.
- **비가역 동작은 확인 모달**(D15): 항목 삭제·모두 지우기·메모리 리셋은 반드시 확인 경유.
- **백업은 git**: `.bak`·`복사본` 금지. 복원은 history.
- **정본 분리**: `CLAUDE.md`는 진입점, `README.md`는 사용자 안내, `rules/`는 현재 결정·상태, `notes/`는 검증·역사 자료로 유지.
- **결정·계획은 문서로**: 대화에만 두지 말고 관련 `rules/dev-*.md`에 반영.
- **결정 번호는 마지막 번호 확인 후 부여**: 코드 주석에 `D<n>`을 쓰기 전에 `rules/dev-decisions.md`의 마지막 행을 먼저 본다. 이미 쓰인 번호를 재사용하면 주석과 결정표가 서로 다른 결정을 가리켜 조용히 어긋난다(2026-08-23 D31 중복 부여 → D34로 정정).
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
- **앱이 OS 클립보드에 쓰는 경로마다 캡처 억제가 필요** — 폴링(당시 800ms, D35 이후 250ms)은 앱이 쓴 값도 사용자 복사로 오인한다. `clip:deduplicate`에만 억제를 걸고 `clip:copy`/`clip:paste`를 빼놓아 재복사 때마다 중복 카드가 생겼다(같은 함정 2회).
  → 클립보드에 쓰는 **모든** 경로에서 `suppressCurrentClipboardCapture()` 호출. 억제 키는 항목 내용이 아니라 *다시 읽은* 클립보드 값이어야 한다(이미지는 왕복 시 재인코딩으로 dataURL 바이트가 달라져 원본과 비교하면 억제가 빗나감).
  → 억제는 타이밍에 기대므로 최종 방어선은 적재 경로의 dedupe-on-insert 다(D34).
- **움직이는 대상에 피드백을 붙이지 말 것** — 복사한 카드는 곧바로 맨 앞으로 승격되는데 '✓ 복사됨'을 그 카드에 얹었더니 사용자가 "볼 새도 없이 옮겨간다"고 했다. 카드 엘리먼트 대신 id로 추적하는 우회(`flashId`)도 시선이 원래 누른 자리에 남는 근본 문제를 못 고쳐 폐기했다.
  → 피드백은 **위치가 고정된 토스트**로 뺀다(D34). 대상 이동과 무관해지므로 지연·보류 로직도 통째로 필요 없어진다.
  → 덧붙여 `transition`은 **이미 DOM에 있는 엘리먼트의 값이 변할 때만** 걸린다. 클래스를 붙인 채 새로 만든 엘리먼트는 페이드 없이 즉시 나타난다(리렌더마다 재생성되면 애니메이션이 통째로 죽는다).
- **새 UI 요소를 만들기 전에 죽은 코드부터 찾을 것** — 토스트를 새로 만들려다 보니 `.toast` CSS와 `<div id="toast">`가 이미 있는데 **아무 데서도 호출되지 않고** 있었다. 필요한 형태 그대로였다.
- **반투명을 비교하려면 뒤에 비칠 것을 깔아야 한다** — 목업에서 불투명도 슬라이더가 "안 먹는다"는 지적을 받았는데, 실제로는 토스트가 빈 배경 위에 있어 알파를 낮춰도 같은 색만 비쳤다. 판정 대상 뒤에 실제 콘텐츠(카드·밝은 이미지)를 깔아야 슬라이더가 의미를 갖는다.
- **모달보다 z-index가 낮은 요소는 모달 안에서 미리보기로 보여준다** — 설정 모달(`z-index:400`)이 열려 있으면 토스트(50)는 가려져 조절 결과를 볼 수 없다. 설정 그룹 안에 같은 클래스를 쓴 인라인 샘플을 넣으면 z-index 싸움 없이 실시간으로 보인다.
- **드래그 위치가 재실행 뒤 겹침** — 프리셋 위치만 저장하면 임의 드래그는 임시 상태가 된다.
  → `windowPosition`을 250ms 디바운스로 저장하고, 다음 실행 때 가장 가까운 화면의 작업 영역 안으로 보정해 복원(D32).
