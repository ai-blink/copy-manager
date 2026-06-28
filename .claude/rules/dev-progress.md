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
- ✅ 스택 확정: Electron 42 + electron-vite 5 + **vite 7**(peer 정렬) + vitest 4 + TypeScript 6(strict) + @nut-tree-fork/nut-js 4. 저장=로컬 JSON

## 실행 명령
- `npm install` · `npm run dev`(electron-vite dev) · `npm run build` · `npm run typecheck`(tsc --noEmit) · `npm test`(vitest)
- ⚠ dev 다회 재시작 시 electron 좀비 누적 가능 → 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`

## 다음
- **S4 (스크롤 리모컨)** / **S5 (상세·확인·설정 모달)** — `dev-roadmap.md` 참조
- 카드 액션(📌⋯🗑️)·우클릭 메뉴·상세 모달은 S5 범위(S3에선 미구현)

## 메모
- 전역 스크롤 리모컨은 이 프로젝트 범위 밖(별도 프로젝트). 리모컨은 느슨 결합으로 설계.
