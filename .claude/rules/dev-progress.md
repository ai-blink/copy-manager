# dev-progress — copy-manager

## 현재 (2026-06-28)
- ✅ 브레인스토밍 완료 (요구사항 발산·수렴)
- ✅ UX 설계서 확정: `notes/brainstorm/2026-06-28_copy-manager_design.md`
- ✅ 동작 mockup v1~v4 (v4 최신, 모든 결정 반영)
- ✅ dev-docs 스캐폴딩 (이 문서들)
- ✅ **S1 (Electron 셸) 구현** — `src/main/` (frameless/alwaysOnTop/transparent 창·전역 핫키 Ctrl+Shift+V 토글·blur→hide 핀 override). GUI 동작 검증은 `notes/MANUAL-SMOKE.md` 위임
- ✅ **S2 (클립보드 캡처/저장) 구현** — `src/shared/clipboard-store/` (캡처·ring buffer 50·핀 카운트 제외·핀 영구보존·타입 분류·JSON 영속화). 단위테스트 6종 통과
- ✅ **S3 (카드 그리드 UI) 구현** — `src/renderer/` (3열·4:3 그리드·타입탭·검색·키보드 탐색·클릭=복사·Enter=붙여넣기). 실사용 검증 완료
- ✅ **붙여넣기 합성(S3e)** — nut.js(`@nut-tree-fork/nut-js`): 직전 창 focus 복원 + Ctrl+V 합성. 실사용 검증 완료
- ✅ **S4 (스크롤 리모컨) 구현** — `src/renderer/src/scroll-remote.ts` (독립 컴포넌트: ▲▼⚙·드웰 게이지·클릭/홀드·드래그·투명도, clipboard 비의존 → 전역판 분리 용이). GUI는 `notes/MANUAL-SMOKE.md` M15~M17
- ✅ **S5 (부가 UI/설정) 구현** — 카드 액션 📌⋯🗑️·우클릭 메뉴·상세/확인/설정 모달(`src/renderer/`) + 설정 영속(`src/shared/settings/`) + main IPC(item:pin·clip:delete/clear/reset·settings:get/set). 비가역 동작 확인 모달 경유(D15). 단위테스트 9종 추가(총 15종 통과). GUI는 M18~M24
- ✅ 스택 확정: Electron 42 + electron-vite 5 + **vite 7**(peer 정렬) + vitest 4 + TypeScript 6(strict) + @nut-tree-fork/nut-js 4. 저장=로컬 JSON(히스토리 `clip-history.json` + 설정 `settings.json`)

## 실행 명령
- `npm install` · `npm run dev`(electron-vite dev) · `npm run build` · `npm run typecheck`(tsc --noEmit) · `npm test`(vitest)
- ⚠ dev 다회 재시작 시 electron 좀비 누적 가능 → 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`

## 다음
- **S1~S5 전 슬라이스 코드 구현 완료.** 남은 것은 GUI 수동 검증(M4·M5·M7~M9 잔여 + M15~M24 신규)과 1주 실사용 체감 평가(`dev-roadmap.md` 하단).
- 후속 최적화 후보(inbox): 이미지 dataURL 대용량 처리, 드웰 가속 곡선, 트레이/백그라운드 상주(현재 모든 창 닫히면 종료).

## 메모
- 전역 스크롤 리모컨은 이 프로젝트 범위 밖(별도 프로젝트). 리모컨은 느슨 결합으로 설계.
