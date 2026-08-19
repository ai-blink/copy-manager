# dev-context — copy-manager

## 현재 상태 (2026-08-19)

- 브랜치 `main`, 앱 버전 `0.2.1`. S1~S6 구현 완료.
- `release\copy-manager Setup 0.2.1.exe`와 `release\win-unpacked\copy-manager.exe`가 존재한다.
- 2026-08-15 전역 단축키 동작을 “재누름 시 숨김”에서 “창 복원·표시·활성화”로 변경했다.
- 최근 기록된 자동 검증은 `npm run typecheck`, `npm test`(17개), `npm run build`, `npm run dist` 통과다.
- dev-docs 정본은 루트 `rules/`이며 `.claude/rules/`에는 위치 안내만 둔다.

## 다음 우선순위

1. `notes/MANUAL-SMOKE.md`의 미완료 GUI 항목을 실제 개발/패키징 앱에서 확인한다.
2. 1주 실사용으로 카드 밀도·창 유지·리모컨의 체감 개선을 평가한다.
3. 보안 후속인 민감 항목 미저장과 외부 내비게이션 차단을 검토한다.
4. 이미지 data URL 대용량 처리와 트레이 상주는 실사용 결과에 따라 결정한다.

## 즉시 실행

- 개발: `npm run dev` 후 `Ctrl+Alt+V`
- 패키지: `release\win-unpacked\copy-manager.exe`
- 검증: `npm run typecheck` · `npm test` · `npm run build`

## 정본 경로

- 아키텍처: `rules/dev-arch.md`
- 확정 결정/미결 질문: `rules/dev-decisions.md` · `rules/dev-decisions-inbox.md`
- 구현·검증 순서: `rules/dev-roadmap.md`
- 완료 이력: `rules/dev-progress.md` · `CHANGELOG.md`
- GUI 검증: `notes/MANUAL-SMOKE.md`

`complexity-hint.json`은 도구 산출물인 미추적 파일이므로 변경·커밋 대상에서 제외한다.
