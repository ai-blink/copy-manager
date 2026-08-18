# dev-roadmap — copy-manager (구현 슬라이스)

> 작게 → 검증 가능 단위. 전부 미착수(TODO).

- [x] **S1 — Electron 셸**: frameless·alwaysOnTop·transparent 창 + 전역 핫키로 창 복원·표시·활성화 + `keepOpen=false`일 때만 blur→hide. ▶ 검증: 핫키가 숨김·최소화·가림 상태의 창을 활성화하고, 기본값에서는 포커스를 잃어도 유지 — *코드 구현 완료(`src/main/`), GUI 동작은 `notes/MANUAL-SMOKE.md` 수동 검증 필요*
- [x] **S2 — 클립보드 캡처/저장**: 캡처 + 50 ring buffer + 핀 영구 보존 + 로컬 영속화 + 타입 분류. ▶ 검증: 복사한 것들이 쌓이고 재시작 후에도 남음 — *로직 구현 완료(`src/shared/clipboard-store/`), 단위테스트 6종 통과(`test/clipboard-store.test.ts`)*
- [x] **S3 — 카드 그리드 UI**: B 검색우선, 3열 설정가능, 4:3 균일, 타입 탭, 키보드 탐색(안 닫힘), 클릭=복사/Enter=붙여넣기. ▶ 검증: 한 화면 9개+, 조작 중 안 닫힘 — *구현 완료(`src/renderer/`). 클릭=복사·키보드 탐색·Enter=붙여넣기(nut.js: 직전 창 focus 복원 + Ctrl+V 합성) 실사용 검증 완료*
- [x] **S4 — 스크롤 리모컨**: 창 내부 플로팅·드웰 게이지·클릭 모드·속도·투명도(호버 불투명)·▲▼⚙. ▶ 검증: 휠 없이 끝까지 스크롤 — *구현 완료(`src/renderer/src/scroll-remote.ts` 독립 컴포넌트, clipboard 비의존). GUI 동작은 `notes/MANUAL-SMOKE.md` M15~M17 수동 검증*
- [x] **S5 — 부가 UI/설정**: 상세 모달·삭제 확인·우클릭 메뉴·빈 상태·설정 모달(핫키·열수·유지개수·드웰·속도·투명도·재부팅 리셋·메모리 리셋) + 카드 액션 📌⋯🗑️. ▶ 검증: 비가역 동작 확인 모달 통과 — *구현 완료(렌더러 모달/메뉴/액션 + `src/shared/settings/` 영속 + main IPC). 단위테스트 9종 추가(store 4·settings 5). GUI는 M18~M24 수동 검증*
- [x] **S6 — 실행 식별·창 배치·표시 밀도**: 헤더/창 제목의 버전·개발/패키지 실행 표시, 현재 모니터 작업 영역 기준 9분할 창 배치와 헤더 드래그 좌표 복원, 카드 열 수 2~8, 전체 UI 배율 75~150% 설정 영속화. ▶ 검증: 설정 라운드트립·누락 키 보강 + typecheck·test(17종)·Windows 패키징(0.2.1) 통과 — *GUI는 `notes/MANUAL-SMOKE.md` M32~M34 수동 검증 필요*

## 1주 실사용 검증 (S1~S5 후)
"win+v보다 안 답답하다" 체감. 안 좋으면 Plan B(리모컨 도킹/드웰 빼고 클릭+고정만) / Plan C(win+v 복귀).
