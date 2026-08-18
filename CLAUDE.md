# copy-manager

Windows 11 `win+v`(클립보드 기록 창)의 불편을 해소하는 **개인용 데스크톱 클립보드 매니저**.

## 스택
- **Electron + TypeScript** (Windows 전용) · 렌더러 우선 vanilla TS(필요 시 경량 프레임워크) · 빌드 Vite · 저장 로컬(JSON/SQLite)

## 현재 상태
- **S1~S5 전 슬라이스 코드 구현 완료** — S1 Electron 셸·S2 캡처/저장·S3 카드 그리드·S4 스크롤 리모컨·S5 부가 UI/설정.
  - `src/main/`(창·핫키·캡처·붙여넣기·IPC), `src/shared/clipboard-store/`, `src/shared/settings/`, `src/renderer/`(그리드·리모컨·모달·설정)
- 단위테스트 15종 통과(`test/clipboard-store.test.ts`·`test/settings-store.test.ts`). typecheck·build 그린.
- 다음: GUI 수동 검증(`notes/MANUAL-SMOKE.md` M4·M5·M7~M9 잔여 + M15~M24) + 1주 실사용 평가 — `rules/dev-roadmap.md`
- 설계 정본: `notes/brainstorm/2026-06-28_copy-manager_design.md`
- 동작 mockup: `notes/brainstorm/04_mockup.html` (검토용, 최신)
- GUI 수동 검증 절차: `notes/MANUAL-SMOKE.md`

## 핵심 경로
| 항목 | 경로 |
|------|------|
| 설계서(UX 계획) | `notes/brainstorm/2026-06-28_copy-manager_design.md` |
| mockup v1~v4 | `notes/brainstorm/0*_mockup.html` (v4=최신) |
| 확정 결정 | `rules/dev-decisions.md` |
| 미결 질문 | `rules/dev-decisions-inbox.md` |
| 로드맵(구현 슬라이스) | `rules/dev-roadmap.md` |
| 진행 상황 | `rules/dev-progress.md` |

## 범위 경계 (이번 프로젝트가 안 하는 것)
- **전역(시스템 전체) 스크롤 리모컨** → 별도 프로젝트로 분리 (이번엔 클립보드 창 내부 전용)
- 클라우드 동기화 / 다국어 / `win+v` 강제 가로채기 / 크로스플랫폼(mac·Linux)

## 작업 규칙
- 코드 변경(Write/Edit) 전 **대상·변경·영향 1~2문장 제시 후 승인** (탐색은 자유)
- 백업은 git에 위임 — `.bak`·`복사본` 금지
- 결정·계획은 대화에만 두지 말고 `rules/dev-*.md`에 반영
- 답변·주석·문서는 한국어

## 실행
- 설치 `npm install` · 개발 `npm run dev` · 빌드 `npm run build` · 타입체크 `npm run typecheck` · 테스트 `npm test`
- 패키징 `npm run dist`(electron-builder, Windows NSIS) → `release\copy-manager Setup <ver>.exe`(설치본) + `release\win-unpacked\copy-manager.exe`(무설치). ⚠ 자동 실행(D30)은 이 패키징된 앱에서만 실제 반영(dev 스킵). 코드 서명 없음(SmartScreen 경고 무방)
- 스택: Electron 42 + electron-vite 5 + vite 8 + vitest 4 + TypeScript 6(strict) · 저장=로컬 JSON(`%APPDATA%\copy-manager\clip-history.json`)
## Cross-Project Delivery Guard

- Follow `C:/ai/projects/AGENT_EXECUTION_GUARDRAILS.md` for implementation evidence and recurrence prevention.
- For implementation requests, planning, research, docs, and handoff are not completion evidence unless explicitly requested.
- Subagents are off by default for delivery. When explicitly requested, use at most one read-only reviewer or explorer unless this repo's core task is agent orchestration.
- Subagent findings must be classified as `BLOCKER`, `FOLLOW_UP`, or `IGNORE_FOR_NOW`; apply only current-scope `BLOCKER`s.
- The lead or parent Codex owns integration, final verification, and commits.
