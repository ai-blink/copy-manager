# 정본 위치 안내 (2026-08-18)

이 프로젝트의 dev-docs 정본은 **프로젝트 루트 `rules/`**입니다(Codex `app-dev-workflow` 정본 경로 + Claude Code 비자동로드).

`.claude/rules/`는 Claude Code가 CLAUDE.md와 동급으로 **매 세션 자동 전체 로드**하는 위치입니다. 이 프로젝트는 dev-docs를 처음부터 `.claude/rules/`에만 두고 있었는데, 매 세션 시작 시 전체가 컨텍스트에 통째로 주입되는 문제가 있어 2026-08-18에 루트 `rules/`로 옮겼습니다(이력 분기는 없었습니다 — 루트 `rules/`가 아예 없었던 단순 위치 이전).

**여기(`.claude/rules/`)에 새 파일을 추가하지 마세요** — dev-docs 갱신은 전부 루트 `rules/*.md`에서 하세요.
