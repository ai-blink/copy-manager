# dev-decisions — copy-manager (확정 결정)

> 출처: 2026-06-28 브레인스토밍. 변경 시 이 표 갱신.

| # | 결정 | 내용 |
|---|------|------|
| D1 | 스택 | Electron + TypeScript, Windows 전용 |
| D2 | 사용자 | 본인 개인용(단일 사용자), 한국어 |
| D3 | 레이아웃 | **B 검색우선 + 카드 그리드** |
| D4 | 그리드 | 한 줄 **3개 기본**(2~8 설정 가능), 카드 비율 **4:3 균일**(행 높이 JS 고정→겹침 방지) |
| D5 | 창 닫힘 | **기본 창 유지**(blur 무시) — 닫기=✕ 버튼. 전역 단축키는 재누름해도 창을 숨기지 않고, 최소화·가림 상태의 창을 복원·표시해 활성화한다. 자동숨김 원하면 설정 `keepOpen` 해제(설정 체크박스 전용). 헤더 **📌는 항상 위(alwaysOnTop) 토글**(창 유지와 별개, 설정에 영속). ※2026-06-28 기본값 반전(기존: 기본 자동숨김+세션 핀), 2026-08-03 항상 위 상태 영속화, 2026-08-15 단축키 활성화 동작 갱신 |
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
| D26 | 설정 저장소 | **로컬 JSON** `settings.json`(`%APPDATA%/copy-manager/`) · `SettingsStore`(electron 무관, 누락 키 기본값 보강). 항목: hotkey·keepOpen·**alwaysOnTop**·cols·keepCount·remoteOpacity·dwellMs·scrollSpeed·remoteMode·rebootReset·**contentProtection**(D28)·uiScale·windowPlacement·windowPosition(D32). 설정 모달이 단일 소스, 변경 즉시 영속+적용 (S5) |
| D27 | 재부팅 리셋 동작 | rebootReset=true면 **앱 시작 시 `resetToDefaults()`** 호출(나머지 기본값 복원, rebootReset 플래그 자체는 유지 → 켜둔 채 계속 리셋). 핫키/유지개수 변경은 main 부수효과(재등록·setMaxSize)로 적용 (S5) |
| D28 | 화면 캡처 방지(보안) | 스크린샷·녹화·화면공유·원격 캡처에서 창 제외 → 클립보드 민감 내용 유출 방지. **`BrowserWindow.setContentProtection`**(Windows: `SetWindowDisplayAffinity` WDA_EXCLUDEFROMCAPTURE, Win10 2004+ / 구버전은 WDA_MONITOR 검은색 폴백). 설정 `contentProtection` 토글, **기본값=true**(보안 우선, 데모 시 해제 가능). `window.ts` createWindow 직후 적용 + `setContentProtection()` 래퍼로 즉시 토글, main 시작 시·`settings:set` 부수효과에서 반영. 한계: RDP 등 일부 원격 경로·물리 카메라 촬영은 미보장(문서 명시) (2026-06-29) |
| D29 | 저장 암호화(유출 방지) | `clip-history.json`을 **Electron `safeStorage`(Windows DPAPI, 현재 사용자 계정에 묶임)**로 암호화 → 파일이 유출돼도 타 계정/머신 복호화 불가. `clipboard-store`는 electron 비의존 유지 → **`Cipher` 포트(encrypt/decrypt) 주입**, 기본 `IDENTITY_CIPHER`(평문, 테스트용). `src/main/cipher.ts`의 `createSafeStorageCipher()`가 DPAPI 구현 주입. 봉투 포맷 `{v:2,alg:'safeStorage',data:base64}`. **구 평문 파일은 load 시 통과 → 첫 save 때 자동 암호화 마이그레이션**. DPAPI 미가용 환경은 평문 폴백+경고(데이터 손실 방지). `settings.json`은 비민감이라 평문 유지. (2026-06-29) |
| D31 | 스크롤 리모컨 on/off | 설정 `remoteEnabled`(기본 **false**, 옵트인) — 창 내부 ▲▼ 플로팅 리모컨 표시/숨김. 끄면 키보드(↑↓)·마우스 휠 탐색만 사용. `scroll-remote.ts` 핸들에 **`setVisible(on)`** 추가(off 시 진행 중 드웰·스크롤 정지 후 `display:none`, 느슨 결합 유지 D18/D25). 설정 모달 체크박스(리모컨 세부 설정 그룹 상단, 마스터 토글) → `applySettings`에서 `remote.setVisible` 반영. 누락키 보강으로 구버전 `settings.json` 호환. (2026-07-09) |
| D30 | 자동 실행(윈도우 시작 시) | 설정 `launchAtStartup`(기본 **false**, 옵트인). **`app.setLoginItemSettings({ openAtLogin })`**(Windows: `HKCU\...\Run` 레지스트리 등록/해제). D28/D26 패턴 재사용 — 설정 모달 체크박스 → `settings:set` 부수효과(`applyLaunchAtStartup`)로 즉시 반영 + main 시작 시 저장값과 OS 로그인 항목 동기화. **`app.isPackaged`false(dev, `npm run dev`)면 스킵+경고**(execPath 가 electron.exe라 자동 실행 무의미) → 설정값은 저장되고 빌드된 앱에서만 실제 반영. `settings.json`(비민감) 평문 유지. (2026-07-09) |
| D32 | 실행 식별·창 배치·표시 밀도 | 헤더와 창 제목에 **`클립보드 v<버전> · 개발 실행/패키지 실행`**을 표시(`app.getVersion()`·`app.isPackaged`). 설정은 `uiScale`(기본 100%, **75~150%**, 5% 단위), `windowPlacement`(기본 중앙), `windowPosition`(헤더 드래그 후 실제 좌표)을 저장한다. 배율은 Electron `webContents.setZoomFactor`로 창 외곽 크기를 유지한 채 전체 UI에 적용한다. 배치는 현재 창이 있는 디스플레이의 `workArea`(작업표시줄 제외)에서 **좌상·상단·우상 / 좌·중앙·우 / 좌하·하단·우하** 중 하나로 이동하며, 드래그 뒤에는 실제 좌표를 250ms 디바운스로 저장해 다음 실행 때 복원한다. 저장된 좌표가 모니터 구성 변경으로 화면 밖이면 가장 가까운 화면의 작업 영역으로 보정한다. 카드 열 수는 **2~8개** 선택으로 확장하며, 구버전 `settings.json`은 누락 키를 기본값으로 보강한다. (2026-08-10) |
