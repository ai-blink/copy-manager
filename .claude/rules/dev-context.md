# dev-context — copy-manager

## 환경
- OS: Windows 11 (전용 타깃)
- 런타임: Electron + TypeScript (Node)
- 개발 셸: PowerShell 우선 (Bash 도구는 Unix 명령 필요 시만)

## 실행 (구현 후 채움)
- 설치/dev/build/package 명령: TBD — S1에서 Electron+Vite 스캐폴딩 시 확정

## 핵심 파일
- 설계 정본: `notes/brainstorm/2026-06-28_copy-manager_design.md`
- mockup: `notes/brainstorm/04_mockup.html` (검토용, 동작본)
- 결정/로드맵/진행: `.claude/rules/dev-*.md`

## 의존성 후보 (미확정 — inbox 참조)
- 붙여넣기 합성: robotjs / nut.js
- 저장: better-sqlite3 또는 JSON
- 빌드: Vite + electron-builder
