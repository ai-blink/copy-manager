# copy-manager

Windows 11 `win+v`의 좁은 화면과 탐색 중 닫힘 문제를 해결하는 개인용 데스크톱 클립보드 매니저다.

## 상태와 경계

- `main`, 앱 `0.2.4`, S1~S11 구현 완료. Electron 42 + TypeScript 6(strict) + electron-vite 5 + Vite 7 + Vitest 4, Windows 전용.
- `typecheck`·테스트 36개·build·dist 통과 기록. 다음은 남은 GUI 수동 검증과 1주 실사용 평가다.
- `%APPDATA%\copy-manager\`의 로컬 JSON을 사용하며 히스토리는 `safeStorage`/DPAPI로 암호화한다.
- 전역 스크롤 리모컨·클라우드·다국어·`win+v` 가로채기·macOS/Linux는 범위 밖이다.

## 정본과 명령

- 사용자 안내·실행: `README.md`; 목표·성공 기준: `rules/dev-brief.md`.
- 즉시 재개: `rules/dev-context.md`; 아키텍처·결정: `rules/dev-arch.md`, `rules/dev-decisions*.md`.
- 로드맵·진행: `rules/dev-roadmap.md`, `rules/dev-progress.md`; GUI 검증: `notes/MANUAL-SMOKE.md`.
- `notes/brainstorm/`은 초기 UX 역사 자료이며 현재 동작 정본이 아니다.
- 실행: `npm install` · `npm run dev` · `npm run typecheck` · `npm test` · `npm run build` · `npm run dist`.

## 작업 규칙

- 파일 수정·삭제 전 대상·변경·영향을 알리고 승인받는다. 백업 파일 대신 Git을 쓰며, 결정·계획은 `rules/dev-*.md`에 반영한다. 답변·주석·문서는 한국어, Windows 셸은 PowerShell을 우선한다.

## Cross-Project Delivery Guard

- Follow `C:/ai/projects/AGENT_EXECUTION_GUARDRAILS.md` for implementation evidence and recurrence prevention.
- For implementation requests, planning, research, docs, and handoff are not completion evidence unless explicitly requested.
- Subagents are off by default for delivery. When explicitly requested, use at most one read-only reviewer or explorer unless this repo's core task is agent orchestration.
- Subagent findings must be classified as `BLOCKER`, `FOLLOW_UP`, or `IGNORE_FOR_NOW`; apply only current-scope `BLOCKER`s.
- The lead or parent Codex owns integration, final verification, and commits.
