# dev-context — copy-manager

## 현재 상태 (2026-08-23)

- 브랜치 `main`, 앱 버전 `0.2.2`. S1~S8 구현 완료.
- `release\copy-manager Setup 0.2.2.exe`와 `release\win-unpacked\copy-manager.exe`를 패키징했다.
- 2026-08-15 전역 단축키 동작을 “재누름 시 숨김”에서 “창 복원·표시·활성화”로 변경했다.
- 2026-08-20 기본 비핀 히스토리를 100개로 늘리고, 1~1000 직접 입력·빠른 값 선택과 핀 보존 중복 제거를 추가했다.
- 2026-08-20 검색바에 현재 결과/최대 보유 개수를 표시하고, 설정을 왼쪽 사이드바 탭으로 분류했다.
- 2026-08-20 전역 단축키 직접 입력을 세 콤보박스 선택으로 교체했다.
- 2026-08-20 단축키 화면 표기를 `Ctrl + Alt + V`처럼 사용자 기준으로 바꾸고, 충돌한 새 키는 경고 후 기존 키를 유지하도록 했다.
- 2026-08-23 기존 카드를 복사·붙여넣기 하면 새 카드 대신 그 항목이 맨 앞으로 승격되도록 바꾸고(D34), 적재 경로도 같은 내용이면 승격하는 dedupe-on-insert 로 전환했다.
- 2026-08-23 복사 피드백을 카드 오버레이에서 창 하단 토스트로 바꾸고(3줄·900ms), 배색 4종과 불투명도·글자 크기·여백을 설정 창/표시 탭에 노출했다. 기본값은 육안 비교로 고른 보라·0.31·13px·10/18px이다.
- 최근 자동 검증은 `npm run typecheck`, `npm test`(33개), `npm run build` 통과다.
- dev-docs 정본은 루트 `rules/`이며 `.claude/rules/`에는 위치 안내만 둔다.

## 다음 우선순위

1. 재복사 승격·중복 카드 방지(M40)를 개발 앱에서 확인하고 D34 변경을 커밋한다.
2. `notes/MANUAL-SMOKE.md`의 미완료 GUI 항목을 실제 개발/패키징 앱에서 확인한다.
3. 보유 개수 직접 입력·빠른 선택과 중복 기록 제거(M36), 검색바·설정 사이드바(M37), 세 콤보박스 단축키와 충돌 처리(M38~M39)를 실제 개발 앱에서 확인한다.
4. 1주 실사용으로 카드 밀도·창 유지·리모컨의 체감 개선을 평가한다.
5. 보안 후속인 민감 항목 미저장과 외부 내비게이션 차단을 검토한다.
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
