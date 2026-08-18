# 다음 세션 이어가기 프롬프트 — copy-manager (2026-06-28 작성)

> 새 세션(Claude Code 또는 Codex)에 **아래 블록을 그대로 복붙**하면 이어집니다.

---

```
copy-manager 프로젝트를 이어서 진행한다. (경로: C:/ai/projects/copy-manager)

먼저 아래를 읽고 맥락을 복원해라:
- CLAUDE.md (프로젝트 개요·스택·범위)
- notes/brainstorm/2026-06-28_copy-manager_design.md (UX 설계 정본)
- notes/brainstorm/04_mockup.html (최신 동작 mockup, 모든 결정 반영)
- rules/dev-decisions.md (확정 결정 D1~D18)
- rules/dev-decisions-inbox.md (미결 질문)
- rules/dev-roadmap.md (구현 슬라이스 S1~S5)

현재 상태: 브레인스토밍·설계 확정, 코드 0줄. 다음 = 로드맵 S1(Electron 셸).

요청: 구현을 시작하기 전에
1) dev-decisions-inbox.md의 우선 3개(붙여넣기 합성 방식 / 저장소 JSON·SQLite / 전역 핫키 기본값)를 먼저 확정 제안해라.
2) 그다음 S1(frameless·alwaysOnTop·transparent 창 + 전역 핫키 토글 + blur→hide(핀 override)) 구현 계획을 원자 태스크로 제시하고, 첫 코드 변경 전 "대상·변경·영향"을 1~2문장으로 보고하고 승인을 받아라.

제약: Electron + TypeScript, Windows 전용. 전역 스크롤 리모컨은 이번 범위 밖(별도 프로젝트). 답변 한국어. 백업은 git에 위임(.bak 금지).
```

---

## 빠른 요약 (사람용)
- **확정**: Electron+TS · B 검색우선 3열 카드(4:3 균일) · 핀 토글 닫힘 · 히스토리 50(핀 제외 영구) · 창 내부 플로팅 스크롤 리모컨(드웰 게이지·투명도/호버 불투명) · 자체 핫키 · 클릭=복사/Enter=붙여넣기 · ⋯상세 모달 · 삭제 확인 · 설정(재부팅 리셋·메모리 리셋) · 타입 탭
- **다음 결정 필요(inbox)**: 붙여넣기 합성 라이브러리 · 저장소 · 핫키 기본값
- **시작점**: 로드맵 S1
