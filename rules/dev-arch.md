# dev-arch — copy-manager

> S1~S6 구현 기준의 현재 아키텍처다. 초기 제안은 `notes/brainstorm/`에 보존한다.

## 프로세스와 데이터 흐름

```text
Windows clipboard
  → main: WM_CLIPBOARDUPDATE 즉시 캡처(+250ms 안전망)·분류 → 350ms 디바운스·암호화 저장
  → preload: 허용된 IPC만 노출
  → renderer: 검색·필터·카드 그리드·모달·스크롤 리모컨
  → main: 복사 또는 직전 앱 포커스 복원 + Ctrl+V 합성
```

- main 프로세스가 단일 앱 인스턴스, 창·전역 단축키·Windows 클립보드 변경 이벤트·250ms 안전망 폴링·350ms 디바운스 저장·붙여넣기·설정 부수효과를 소유한다. `WM_CLIPBOARDUPDATE` 감시는 내용에 접근하지 않고 변경 신호만 main으로 전달하며, main의 Electron clipboard가 실제 내용을 읽는다(D36). 중복 제거 직후와 앱에서 항목을 복사·붙여넣기 한 직후에는 현재 OS 클립보드가 즉시 재적재되지 않도록 해당 값만 캡처하지 않는다. 복사·붙여넣기는 그 항목을 새 카드 대신 맨 앞으로 승격한다(D34). 새 캡처·승격 시 렌더러는 목록 맨 위로 이동한다(D35).
- renderer는 UI 상태와 사용자 입력을 소유하며 Node API에 직접 접근하지 않는다.
- preload는 `contextBridge`를 통해 고정된 API만 전달한다.

## 모듈 경계

- `src/shared/clipboard-store/`: 캡처, 타입 분류, 기본 100개 ring buffer(1~1000 설정), 핀 영구 보존, 중복 정리, JSON 영속. 적재는 dedupe-on-insert 로, 같은 타입·내용이 이미 있으면 새 카드 대신 `promote()` 로 맨 앞에 올려 개수·id·핀을 보존한다(D34). 저장은 호출 순서대로 직렬화하고 임시 파일 완성 후 교체한다(D35). Electron 비의존이며 `Cipher` 포트를 주입받는다.
- `src/shared/settings/`: `SettingsStore`, 누락 키 기본값 보강, 재시작 리셋. 토스트 배색(`toastTheme` 4종)과 불투명도·글자 크기·여백은 `TOAST_LIMITS` 범위로 보정한다(잘못된 값은 기본값으로 되돌린다). Electron 비의존이다.
- `src/main/cipher.ts`: Electron `safeStorage`/Windows DPAPI 암호화 어댑터와 평문 마이그레이션.
- `src/main/clipboard-watcher.ts`: 숨은 WinForms 메시지 창으로 `WM_CLIPBOARDUPDATE`를 받아 main에 변경 신호만 전달하는 Windows 어댑터. 실패 시 기존 250ms 폴링이 계속 동작한다.
- `src/main/window.ts`: frameless 창, 표시·활성화, 자동숨김, 항상 위, 화면 캡처 방지, 배율, 9분할 배치와 드래그 좌표 복원, renderer 검색 포커스용 창 활성화 알림(D37).
- `src/main/hotkey.ts`: 전역 단축키 등록·교체. 새 키 등록에 실패하면 이전 키를 해제하지 않는다.
- `src/main/paste.ts`: 직전 창 포커스 복원과 순차 `Ctrl+V` 합성.
- `src/main/index.ts`: 단일 인스턴스 앱 수명주기, 이벤트 기반 캡처+250ms 안전망 폴링, 350ms 저장 디바운스·종료 전 flush, IPC, 설정 부수효과, 드래그 좌표 저장.
- `src/preload/index.ts`: renderer용 `copyManager` API.
- `src/renderer/src/main.ts`: 검색·필터·그리드·카드 액션·모달·검색 결과/최대 보유 수 표기·왼쪽 사이드바 설정 탭·세 콤보박스 단축키 조합과 단축키 충돌 알림을 소유한다. 카드가 놓이지 않은 실제 본문 여백만 드래그 영역으로 맞추며, 창 활성화 시 모달·우클릭 메뉴가 없을 때 검색 입력 포커스를 복원한다(D37).
- `src/renderer/src/scroll-remote.ts`: 스크롤 대상만 주입받는 독립 리모컨 컴포넌트.

## IPC 표면

- 조회: `app:get-info`, `history:get`, `settings:get`
- 창: `window:hide`, `window:toggle-aot`
- 항목: `clip:copy`, `clip:paste`, `item:pin`, `clip:delete`, `clip:clear`, `clip:deduplicate`, `clip:reset`
- 설정: `settings:set`, `hotkey:set`(새 키 등록 성공 시에만 저장)
- main → renderer 알림: `history:changed`, `settings:changed`

## 저장

- `%APPDATA%\copy-manager\clip-history.json`: `{v:2, alg:'safeStorage', data:<base64>}` 봉투 형식. 구 평문 배열은 다음 저장 때 암호화한다.
- `%APPDATA%\copy-manager\settings.json`: 비민감 설정을 평문 JSON으로 저장한다.
- SQLite는 현재 구현과 계획에 포함하지 않는다.

## 보안 경계

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- renderer는 shared 모듈을 `import type`으로만 참조하며 사용자 내용은 `textContent`로 렌더링한다.
- `setContentProtection`은 소프트웨어 캡처 노출을 줄이지만 RDP·가상화·물리 카메라는 보장하지 않는다.
- DPAPI는 파일 유출 방어용이며 동일 Windows 사용자 권한을 획득한 악성 코드까지 막지 못한다.
