# dev-progress — copy-manager

## 현재 (2026-06-28)
- ✅ 브레인스토밍 완료 (요구사항 발산·수렴)
- ✅ UX 설계서 확정: `notes/brainstorm/2026-06-28_copy-manager_design.md`
- ✅ 동작 mockup v1~v4 (v4 최신, 모든 결정 반영)
- ✅ dev-docs 스캐폴딩 (이 문서들)
- ✅ **S1 (Electron 셸) 구현** — `src/main/` (frameless/alwaysOnTop/transparent 창·전역 핫키 Ctrl+Alt+V로 창 복원·표시·활성화·`keepOpen=false`일 때만 blur→hide). GUI 동작 검증은 `notes/MANUAL-SMOKE.md` 위임
- ✅ **S2 (클립보드 캡처/저장) 구현** — `src/shared/clipboard-store/` (캡처·ring buffer 50·핀 카운트 제외·핀 영구보존·타입 분류·JSON 영속화). 단위테스트 6종 통과
- ✅ **S3 (카드 그리드 UI) 구현** — `src/renderer/` (3열·4:3 그리드·타입탭·검색·키보드 탐색·클릭=복사·Enter=붙여넣기). 실사용 검증 완료
- ✅ **붙여넣기 합성(S3e)** — nut.js(`@nut-tree-fork/nut-js`): 직전 창 focus 복원 + Ctrl+V 합성. 실사용 검증 완료
- ✅ **S4 (스크롤 리모컨) 구현** — `src/renderer/src/scroll-remote.ts` (독립 컴포넌트: ▲▼⚙·드웰 게이지·클릭/홀드·드래그·투명도, clipboard 비의존 → 전역판 분리 용이). GUI는 `notes/MANUAL-SMOKE.md` M15~M17
- ✅ **S5 (부가 UI/설정) 구현** — 카드 액션 📌⋯🗑️·우클릭 메뉴·상세/확인/설정 모달(`src/renderer/`) + 설정 영속(`src/shared/settings/`) + main IPC(item:pin·clip:delete/clear/reset·settings:get/set). 비가역 동작 확인 모달 경유(D15). 단위테스트 9종 추가(총 15종 통과). GUI는 M18~M24
- ✅ **보안: 화면 캡처 방지(D28) 구현** (2026-06-29) — `window.ts` `setContentProtection`(기본 on, `BrowserWindow.setContentProtection`) + 설정 `contentProtection` 토글(모달 체크박스·preload 제네릭 통과·main 시작/`settings:set` 반영). typecheck·build·test(15종, 라운드트립·누락키 보강 보강) 그린. GUI는 `notes/MANUAL-SMOKE.md` M25~M28
- ✅ **스크롤 리모컨 on/off(D31) 구현·GUI 검증** (2026-07-09) — 설정 `remoteEnabled`(기본 off, 옵트인) + `scroll-remote.ts` `setVisible(on)`(off 시 스크롤 정지+숨김, 느슨 결합 유지). 설정 모달 체크박스·`applySettings` 반영. typecheck·build·test 17종 그린 + dev 실동작 검증(기본 숨김·체크 토글) 성공.
- ✅ **자동 실행(D30) 구현** (2026-07-09) — 설정 `launchAtStartup`(기본 off, 옵트인) + `app.setLoginItemSettings` 반영. 설정 모달 체크박스·`settings:set` 부수효과(`applyLaunchAtStartup`)·main 시작 시 OS 로그인 항목 동기화. dev(비패키징)는 스킵+경고. typecheck·build·test(17종) 그린.
- ✅ **항상 위 상태 유지 버그 수정** (2026-08-03) — 헤더 📌의 `alwaysOnTop` 값을 설정에 저장하고, 창 생성·렌더러 표시 시 저장값을 적용. 꺼 둔 상태는 단축키 재호출과 앱 재시작 뒤에도 유지.
- ✅ **전역 단축키 창 활성화 동작 갱신** (2026-08-15) — 재누름 시 창을 숨기던 동작을 제거했다. 숨김·최소화·가림 상태에서는 창을 복원·표시·포커스하며, 이미 포커스된 창에서는 붙여넣기용 직전 앱 기록을 유지한다. `npm run typecheck`·`npm test`(17종)·`npm run build` 통과 후 `npm run start` 실행 확인. GUI 수동 검증은 M3·M4에 남김.
- ✅ **실행 식별·창 배치·표시 밀도(D32) 구현** (2026-08-10) — `v0.2.1 · 개발 실행/패키지 실행`을 헤더·창 제목에 표시. 설정 `windowPlacement`(현재 모니터 작업 영역 기준 9분할 즉시 이동)·`windowPosition`(헤더 드래그 뒤 실제 좌표 저장·복원, 화면 밖 좌표 보정)·`uiScale`(75~150%, 전체 UI 확대/축소)을 영속화하고, 카드 열 수를 2~8로 확장. 구 `settings.json` 누락 키 기본값 보강 및 설정 라운드트립 테스트 추가. typecheck·test(17종)·Windows 패키징(`0.2.1`) 그린. GUI는 `notes/MANUAL-SMOKE.md` M32~M34.
- ✅ **보안: 저장 암호화(D29) 구현** (2026-06-29) — `clip-history.json`을 safeStorage/DPAPI로 암호화. `clipboard-store`에 `Cipher` 포트 주입(electron 비의존 유지, 기본 IDENTITY=평문) + `src/main/cipher.ts`(`createSafeStorageCipher`) + main 주입. 구 평문 파일 자동 마이그레이션. typecheck·build·test(**17종**, cipher 라운드트립·마이그레이션 +2) 그린. GUI는 M29
- ✅ 스택 확정: Electron 42 + electron-vite 5 + **vite 7**(peer 정렬) + vitest 4 + TypeScript 6(strict) + @nut-tree-fork/nut-js 4. 저장=로컬 JSON(히스토리 `clip-history.json` + 설정 `settings.json`)

## 실행 명령
- `npm install` · `npm run dev`(electron-vite dev) · `npm run build` · `npm run typecheck`(tsc --noEmit) · `npm test`(vitest)
- ⚠ dev 다회 재시작 시 electron 좀비 누적 가능 → 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`

## 다음
- **S1~S5 전 슬라이스 코드 구현 완료.** 남은 것은 GUI 수동 검증(M4·M5·M7~M9 잔여 + M15~M24 신규)과 1주 실사용 체감 평가(`dev-roadmap.md` 하단).
- 후속 최적화 후보(inbox): 이미지 dataURL 대용량 처리, 드웰 가속 곡선, 트레이/백그라운드 상주(현재 모든 창 닫히면 종료).

## 메모
- 전역 스크롤 리모컨은 이 프로젝트 범위 밖(별도 프로젝트). 리모컨은 느슨 결합으로 설계.
