# dev-arch — copy-manager (아키텍처 · 파일 맵)

> S1~S5 구현 완료(2026-06-28). 아래 구조는 실제 코드와 일치. 변경 시 갱신.

## 프로세스 구성 (Electron)
```
main (Node)                      renderer (창 UI)
├─ 창 관리                        ├─ App 셸 (검색·탭·그리드)
│  frameless·alwaysOnTop·         ├─ ClipboardGrid (카드 4:3, 키보드 탐색)
│  transparent, blur→hide(핀)     ├─ Card (호버 액션 📌⋯🗑️, 클릭=복사 플래시)
├─ 전역 핫키 (globalShortcut)     ├─ ScrollRemote ★느슨결합 (드웰 게이지·드래그·투명도)
├─ 클립보드 캡처 (폴링/후킹)      ├─ DetailModal / ConfirmModal / SettingsModal
├─ 히스토리 스토어 (50 ring +     └─ EmptyState
│  핀 영구, JSON/SQLite 영속)
├─ 붙여넣기 합성 (Ctrl+V 주입)
└─ 설정 스토어 (재부팅 리셋 옵션)
        │  IPC (preload, contextIsolation)
        └──────────────┘
```

## 모듈 경계 (구현 — 실제 경로)
- `src/shared/clipboard-store/` — 캡처(`capture.ts`)·ring buffer/핀/영속(`store.ts`)·타입 분류(`classify.ts`). electron 비의존(테스트 가능)
- `src/shared/settings/` — `SettingsStore`(JSON 영속·누락키 보강·재부팅 리셋). electron 비의존
- `src/renderer/src/scroll-remote.ts` — **독립 컴포넌트** `mountScrollRemote({target,container})→handle`. clipboard 비의존(입력=스크롤 대상/경계, 출력=`scrollTop`), 전역판 분리 대비 느슨 결합(D18/D25)
- `src/renderer/src/main.ts` — 그리드·타입탭·검색·키보드 탐색·카드 액션·우클릭 메뉴·상세/확인/설정 모달·설정 적용
- `src/main/` — `window.ts`(창·blur→hide·직전창 focus 복원·화면 캡처 방지 `setContentProtection` D28)·`hotkey.ts`(전역 핫키·재등록)·`paste.ts`(Ctrl+V 합성)·`index.ts`(캡처 폴링·IPC·설정 적용)
- `src/preload/index.ts` — contextBridge `copyManager` API(history/copy/paste/pinItem/delete/clear/reset/settings)

## IPC 표면 (preload, contextIsolation)
- 조회: `history:get` · `settings:get`
- 동작: `clip:copy` · `clip:paste` · `item:pin` · `clip:delete` · `clip:clear` · `clip:reset` · `pin:set`(창 핀) · `settings:set`
- 알림(main→renderer): `history:changed` · `settings:changed`

## 보안/Electron 기본
- contextIsolation on, nodeIntegration off, sandbox on, preload(CJS)로 최소 IPC 노출
- 렌더러는 shared 모듈에서 `import type`만 사용 → node:fs 비번들(XSS는 textContent로 차단)
- **화면 캡처 방지(D28)**: `setContentProtection`(기본 on)으로 스크린샷/녹화/화면공유에서 창 제외 → 클립보드 민감 내용 유출 방지. 설정 토글, RDP·물리 카메라는 미보장
