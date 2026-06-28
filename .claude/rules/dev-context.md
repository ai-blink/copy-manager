# dev-context — copy-manager (즉시 재개 맥락 · 스냅샷)

## 환경
- OS: Windows 11 (전용 타깃)
- 런타임: Electron 42 + TypeScript 6(strict) (Node)
- 개발 셸: PowerShell 우선 (Bash 도구는 Unix 명령 필요 시만)

## 실행 명령
- 설치 `npm install` · 개발 `npm run dev`(electron-vite dev, HMR) · 빌드 `npm run build`
- 타입체크 `npm run typecheck`(tsc --noEmit) · 테스트 `npm test`(vitest, 15종) · 미리보기 `npm start`(preview)
- ⚠ dev 재시작 전 좀비 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`
- ⚠ 창은 `show:false`로 시작 → 기동 후 **Ctrl+Shift+V**로 띄움

## 현재 상태 (2026-06-28)
- **S1~S5 전 슬라이스 코드 구현·실사용 검증·커밋 완료** (커밋 `21cabee` S4~S5, `456b15f` S1~S3). 작업 트리 클린.
- 남은 것: GUI 수동 검증 잔여(`notes/MANUAL-SMOKE.md` M4·M5·M7~M9 + M15~M24) + **1주 실사용 평가**("win+v보다 안 답답한가").

## 핵심 파일
- 설계 정본: `notes/brainstorm/2026-06-28_copy-manager_design.md` · mockup: `notes/brainstorm/04_mockup.html`
- 코드: `src/main/`(창·핫키·캡처·붙여넣기·IPC) · `src/shared/clipboard-store/` · `src/shared/settings/` · `src/renderer/`(그리드·리모컨·모달·설정)
- 결정/로드맵/진행/피드백: `.claude/rules/dev-*.md`

## 확정 의존성 (구 inbox 후보 → 해소)
- 붙여넣기 합성: **@nut-tree-fork/nut-js** (D23)
- 저장: **로컬 JSON** (`clip-history.json` + `settings.json`), SQLite 후순위 (D21)
- 빌드: **electron-vite 5 + vite 7** (D19)
