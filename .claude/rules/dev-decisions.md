# dev-decisions — copy-manager (확정 결정)

> 출처: 2026-06-28 브레인스토밍. 변경 시 이 표 갱신.

| # | 결정 | 내용 |
|---|------|------|
| D1 | 스택 | Electron + TypeScript, Windows 전용 |
| D2 | 사용자 | 본인 개인용(단일 사용자), 한국어 |
| D3 | 레이아웃 | **B 검색우선 + 카드 그리드** |
| D4 | 그리드 | 한 줄 **3개 기본**(2~5 설정 가능), 카드 비율 **4:3 균일**(행 높이 JS 고정→겹침 방지) |
| D5 | 창 닫힘 | **기본 창 유지**(blur 무시) — 닫기=핫키 재누름 또는 ✕ 버튼. 자동숨김 원하면 설정 `keepOpen` 해제(설정 체크박스 전용). 헤더 **📌는 항상 위(alwaysOnTop) 토글**(창 유지와 별개, 세션). ※2026-06-28 기본값 반전(기존: 기본 자동숨김+세션 핀) |
| D6 | 키보드 | ←→↑↓ 그리드 탐색, **조작 중 창 안 닫힘** |
| D7 | 히스토리 유지 | **기본 50개**(설정 가능), 초과분 오래된 것부터 삭제, **핀 항목은 카운트 제외·영구 보존** |
| D8 | 스크롤 리모컨 | **창 내부 플로팅**(창 영역 내 자유 드래그). ▲▼⚙ 3버튼. 4모서리·도킹 개념 **폐기** |
| D9 | 리모컨 활성화 | 드웰(호버 유지→아래서 위로 차오르는 게이지→임계시간 후 스크롤) / 클릭·홀드 모드. 속도 설정 |
| D10 | 리모컨 투명도 | 평소 반투명(설정값), **호버 시 불투명** |
| D11 | 전역 핫키 | **자체 핫키**(설정 변경 가능, 예 Ctrl+Shift+V). win+v 가로채기 안 함, OS 기록과 공존 |
| D12 | 항목 선택 동작 | **클릭 = 복사**(시각화 "✓ 복사됨") / **Enter·더블클릭 = 직전 앱에 붙여넣기** (구분) |
| D13 | 카드 액션 | 호버 시 📌 ⋯ 🗑️ + 우클릭 메뉴(복사·평문붙여넣기·상세·핀·삭제) |
| D14 | 상세 보기 | 카드 ⋯ → **상세 모달**(전체 내용 + 복사/붙여넣기/핀/삭제) |
| D15 | 삭제 안전 | 항목 삭제·모두 지우기·메모리 리셋은 **확인 모달** 경유(비가역 방지) |
| D16 | 타입 탭 | 전체/텍스트/이미지/링크/코드 (이미지=썸네일 카드) |
| D17 | 설정 화면 | ⚙️ 모달: 핫키·**☑ 창 유지**·카드 수·유지 개수·리모컨(투명도·드웰·속도·모드) + **☑ 재부팅 시 기본값 리셋** + **[메모리 리셋]** |
| D18 | 범위 경계 | 전역 스크롤 리모컨은 **별도 프로젝트** — 단 떼어내기 쉽게 **느슨 결합 컴포넌트**로 설계 |
| D19 | 빌드/번들 | electron-vite 5 + vite 7(peer 정렬) · main=CJS(`index.js`), preload=CJS(`.cjs`, sandbox 호환), renderer=ESM. electron·nut.js는 external |
| D20 | 클립보드 캡처 | 폴링 방식(`clipboard.readText/readImage`) 800ms · 직전 항목과 동일 내용이면 skip (S2 inbox 해소) |
| D21 | 저장소 | 로컬 JSON(`%APPDATA%/copy-manager/clip-history.json`) · SQLite는 후순위 (inbox 해소) |
| D22 | 전역 핫키 기본값 | **Ctrl+Alt+V**(`CommandOrControl+Alt+V`) — 구 Ctrl+Shift+V는 터미널 붙여넣기와 충돌(globalShortcut 전역 독점이라 터미널 입력을 가로챔) → 2026-06-28 변경. 설정 모달에서 변경 가능 |
| D23 | 붙여넣기 합성 | **@nut-tree-fork/nut-js**(공식 @nut-tree/nut-js 비공개→공개 fork) · 직전 창 `getActiveWindow` 저장→`focus()` 복원→`Ctrl↓V↓V↑Ctrl↑`(autoDelayMs 40) 순차 합성 (inbox 해소) |
| D24 | 렌더러 | **vanilla TS**(프레임워크 미도입) — S3 규모는 충분, 가상 스크롤 불필요 (inbox 해소) |
| D25 | 스크롤 리모컨 구조 | **독립 컴포넌트** `scroll-remote.ts`(`mountScrollRemote({target,container,...})→handle`). clipboard 도메인 비의존(입력=스크롤 대상/경계, 출력=`target.scrollTop`). 드웰/스크롤은 rAF 기반. 기본값: 드웰 700ms·속도 6px/frame·투명도 0.65. 전역판 분리 시 이 파일만 떼어냄(D18) (S4) |
| D26 | 설정 저장소 | **로컬 JSON** `settings.json`(`%APPDATA%/copy-manager/`) · `SettingsStore`(electron 무관, 누락 키 기본값 보강). 항목: hotkey·keepOpen·cols·keepCount·remoteOpacity·dwellMs·scrollSpeed·remoteMode·rebootReset. 설정 모달이 단일 소스, 변경 즉시 영속+적용 (S5) |
| D27 | 재부팅 리셋 동작 | rebootReset=true면 **앱 시작 시 `resetToDefaults()`** 호출(나머지 기본값 복원, rebootReset 플래그 자체는 유지 → 켜둔 채 계속 리셋). 핫키/유지개수 변경은 main 부수효과(재등록·setMaxSize)로 적용 (S5) |
