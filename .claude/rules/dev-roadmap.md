# dev-roadmap — copy-manager (구현 슬라이스)

> 작게 → 검증 가능 단위. 전부 미착수(TODO).

- [x] **S1 — Electron 셸**: frameless·alwaysOnTop·transparent 창 + 전역 핫키 토글 show/hide + blur→hide(핀 override). ▶ 검증: 핫키로 창 토글, 핀이면 포커스 잃어도 유지 — *코드 구현 완료(`src/main/`), GUI 동작은 `notes/MANUAL-SMOKE.md` 수동 검증 필요*
- [x] **S2 — 클립보드 캡처/저장**: 캡처 + 50 ring buffer + 핀 영구 보존 + 로컬 영속화 + 타입 분류. ▶ 검증: 복사한 것들이 쌓이고 재시작 후에도 남음 — *로직 구현 완료(`src/shared/clipboard-store/`), 단위테스트 6종 통과(`test/clipboard-store.test.ts`)*
- [x] **S3 — 카드 그리드 UI**: B 검색우선, 3열 설정가능, 4:3 균일, 타입 탭, 키보드 탐색(안 닫힘), 클릭=복사/Enter=붙여넣기. ▶ 검증: 한 화면 9개+, 조작 중 안 닫힘 — *구현 완료(`src/renderer/`). 클릭=복사·키보드 탐색·Enter=붙여넣기(nut.js: 직전 창 focus 복원 + Ctrl+V 합성) 실사용 검증 완료*
- [ ] **S4 — 스크롤 리모컨**: 창 내부 플로팅·드웰 게이지·클릭 모드·속도·투명도(호버 불투명)·▲▼⚙. ▶ 검증: 휠 없이 끝까지 스크롤
- [ ] **S5 — 부가 UI/설정**: 상세 모달·삭제 확인·우클릭 메뉴·빈 상태·설정 모달(핫키·열수·유지개수·드웰·속도·투명도·재부팅 리셋·메모리 리셋). ▶ 검증: 비가역 동작 확인 모달 통과

## 1주 실사용 검증 (S1~S5 후)
"win+v보다 안 답답하다" 체감. 안 좋으면 Plan B(리모컨 도킹/드웰 빼고 클릭+고정만) / Plan C(win+v 복귀).
