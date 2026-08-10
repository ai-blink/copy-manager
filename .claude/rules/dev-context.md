# dev-context — copy-manager (즉시 재개 맥락 · 스냅샷)

## 현재 상태 (2026-08-10)
- 브랜치 `main`, 다음 릴리즈 `v0.2.1` 준비 완료: 앱 내부 버전/실행 모드 표시, 카드 2~8열, UI 배율 75~150%, 9분할 창 배치, 헤더 드래그 좌표 복원.
- 설치본 `release\copy-manager Setup 0.2.1.exe`와 무설치본 `release\win-unpacked\copy-manager.exe` 생성 완료.
- `npm run typecheck`·`npm test`(17개)·`npm run dist` 통과. GUI 확인은 `notes/MANUAL-SMOKE.md` M32~M34 및 기존 미완료 항목이 남아 있음.

## 즉시 재개
- 개발 실행: `npm run dev` 후 `Ctrl+Alt+V`. 패키지 실행은 `release\copy-manager Setup 0.2.1.exe` 설치 또는 `release\win-unpacked\copy-manager.exe`.
- 다음 기능 검토 전 우선: 1주 실사용 평가, GUI 수동 검증, 보안 후속(민감 항목 미저장·외부 내비게이션 차단).
- `complexity-hint.json`은 도구 산출물로 미추적 상태이며 릴리즈 커밋에서 제외한다.

## 핵심 경로
- 기능/설정: `src/main/window.ts`·`src/main/index.ts`·`src/shared/settings/`·`src/renderer/`
- 상태/결정: `.claude/rules/dev-progress.md`·`dev-decisions.md`·`dev-roadmap.md`
- 수동 검증: `notes/MANUAL-SMOKE.md` · 배포 이력: `CHANGELOG.md`
