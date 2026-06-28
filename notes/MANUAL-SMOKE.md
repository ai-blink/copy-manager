# MANUAL-SMOKE — copy-manager S1/S2 수동 검증 절차

> Electron 창·전역 핫키·blur 동작은 **실제 디스플레이가 있어야** 검증 가능하다(헤드리스 불가).
> 아래 항목은 자동 검증에서 제외되며, 사용자가 직접 실행해 ✅/❌ 를 채운다.
> 자동 검증(설치·tsc·build·store 테스트)은 최종 보고 표 참조.

## 사전 준비
```powershell
cd C:\ai\projects\copy-manager
npm install      # 최초 1회
npm run dev      # electron-vite dev (HMR) — 또는 npm run build && npm start
```

## 기동 확인 (2026-06-28)
- `npm run dev` → main/preload/renderer 빌드 + **Electron 프로세스 기동까지 무에러 확인**(18초 폴링).
- ⚠ **창은 `show:false`로 시작** → 기동 직후 화면에 보이지 않음. **Ctrl+Shift+V로 띄울 것**(아래 M3). 이것이 win+v 대체 설계(핫키 호출형).

### 트러블슈팅 (기동 실패 시)
- `Error: Electron uninstall` / `Electron failed to install correctly`:
  - (1) Electron 바이너리 미설치 → `node node_modules/electron/install.js` (약 232MB 다운로드)
  - (2) main 번들에 electron 이 인라인된 경우 → `electron.vite.config.ts`의 `externalizeDepsPlugin()` + `external: ['electron']` 확인
- 포트 점유(`Port 5173 is in use`)는 이전 dev 잔류 프로세스 때문 — 자동으로 다음 포트 사용(동작 무관).

## 검증 항목 (S1 — Electron 셸)

| # | 절차 | 기대 결과 | 결과 |
|---|------|-----------|------|
| M1 | `npm run dev` 실행 | 앱이 기동되고 콘솔 에러 없음 | ✅ 2026-06-28 기동·무에러 |
| M2 | 창 스타일 확인 | **테두리 없음(frameless)** · 항상 위(alwaysOnTop) · 배경 반투명(transparent) · 둥근 모서리 | ✅ 스크린샷 확인(frameless·다크 반투명). alwaysOnTop 별도 미확인 |
| M3 | 전역 핫키 토글 | 다른 앱에 포커스가 있어도 **Ctrl+Shift+V** 누르면 창이 뜨고, 다시 누르면 숨음 | ✅ 핫키로 창 등장 확인(show:false 시작 → 핫키로 표시됨). 재누름 숨김은 미확인 |
| M4 | blur → 자동숨김 | 창이 뜬 상태에서 **바깥(다른 앱)을 클릭**하면 창이 사라짐 | ⬜ |
| M5 | 핀 유지(핀이면 안 닫힘) | DevTools 콘솔에서 `copyManager.setPinned(true)` 실행 후 바깥 클릭 → **창 유지**. `copyManager.setPinned(false)` 후 바깥 클릭 → 숨음 | ⬜ |

> M3 핫키 등록 실패 로그(`전역 핫키 등록 실패`)가 보이면 다른 앱이 Ctrl+Shift+V 를 선점한 것 — 충돌 앱 종료 후 재시도.

## 검증 항목 (S2 — 클립보드 캡처/저장)

| # | 절차 | 기대 결과 | 결과 |
|---|------|-----------|------|
| M6 | 복사 → 적재 | 아무 텍스트나 복사(Ctrl+C) 후 핫키로 창 열기 → 상태줄 "클립 항목 N개 적재됨" 숫자 증가 | ✅ 복사 시 숫자 증가 확인(3개) |
| M7 | 타입 분류 | URL 복사 시 link, 코드 조각 복사 시 code 로 저장(현재 스텁 UI엔 개수만 표시 → DevTools `await copyManager.getHistory()` 로 `type` 확인) | ⬜ |
| M8 | 재시작 후 잔존 | 몇 개 복사 후 앱 종료 → 재실행 → 이전 항목이 그대로 남아 있음(개수 유지) | ⬜ |
| M9 | 핀 영구 보존 | 50개 초과로 복사해도 핀 항목은 사라지지 않음(핀 UI는 S3, 현재는 `getHistory()` 로 확인) | ⬜ |

> 영속 파일 위치: `%APPDATA%\copy-manager\clip-history.json` (Electron `app.getPath('userData')`).

## 검증 항목 (S3 — 카드 그리드 UI)

| # | 절차 | 기대 결과 | 결과 |
|---|------|-----------|------|
| M10 | 카드 그리드 | Ctrl+Shift+V로 창 열기 → 복사 기록이 3열·4:3 카드로 표시(한 화면 9개+) | ✅ |
| M11 | 타입 탭/검색 | 전체/텍스트/이미지/링크/코드 탭 클릭 필터 + 검색창 입력 필터 | ✅ |
| M12 | 키보드 탐색 | ←→↑↓로 카드 이동(보라 선택 테두리), 조작 중 창 안 닫힘(D6) | ✅ |
| M13 | 클릭=복사 | 카드 클릭 → "✓ 복사됨" 플래시 + 클립보드에 적재(D12) | ✅ |
| M14 | Enter/더블클릭=붙여넣기 | 카드에서 Enter → 창 숨김 → **직전 앱 focus 복원 + Ctrl+V 합성**으로 그 앱에 입력(D12/S3e, nut.js) | ✅ 2026-06-28 실사용 확인 |

> M14 트러블슈팅(과거 발생): ① 포커스 미복원 → `getActiveWindow` 저장 후 `focus()` 복원으로 해결. ② Ctrl+V 미입력 → `pressKey(Ctrl,V)` 동시누름+`autoDelayMs:0` 대신 `Ctrl↓V↓V↑Ctrl↑` 순차+40ms 간격으로 해결.

## 기계 검증으로 커버되는 것 (수동 불필요)
- ring buffer 50 / 핀 카운트 제외 / 핀 생존 / 타입 분류 매핑 / 저장-재로딩 라운드트립
  → `npm test` (vitest) 자동 검증. 테스트: `test/clipboard-store.test.ts`.
- tsconfig strict 타입 안정성 → `npm run typecheck` (`tsc --noEmit`).
- main/preload/renderer 번들 빌드 → `npm run build`.
