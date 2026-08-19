# dev-arch — copy-manager

> S1~S6 구현 기준의 현재 아키텍처다. 초기 제안은 `notes/brainstorm/`에 보존한다.

## 프로세스와 데이터 흐름

```text
Windows clipboard
  → main: 800ms 캡처·분류·암호화 저장
  → preload: 허용된 IPC만 노출
  → renderer: 검색·필터·카드 그리드·모달·스크롤 리모컨
  → main: 복사 또는 직전 앱 포커스 복원 + Ctrl+V 합성
```

- main 프로세스가 창·전역 단축키·클립보드 폴링·저장·붙여넣기·설정 부수효과를 소유한다.
- renderer는 UI 상태와 사용자 입력을 소유하며 Node API에 직접 접근하지 않는다.
- preload는 `contextBridge`를 통해 고정된 API만 전달한다.

## 모듈 경계

- `src/shared/clipboard-store/`: 캡처, 타입 분류, 기본 50개 ring buffer, 핀 영구 보존, JSON 영속. Electron 비의존이며 `Cipher` 포트를 주입받는다.
- `src/shared/settings/`: `SettingsStore`, 누락 키 기본값 보강, 재시작 리셋. Electron 비의존이다.
- `src/main/cipher.ts`: Electron `safeStorage`/Windows DPAPI 암호화 어댑터와 평문 마이그레이션.
- `src/main/window.ts`: frameless 창, 표시·활성화, 자동숨김, 항상 위, 화면 캡처 방지, 배율, 9분할 배치와 드래그 좌표 복원.
- `src/main/hotkey.ts`: 전역 단축키 등록·재등록.
- `src/main/paste.ts`: 직전 창 포커스 복원과 순차 `Ctrl+V` 합성.
- `src/main/index.ts`: 앱 수명주기, 800ms 캡처 폴링, IPC, 설정 부수효과, 드래그 좌표 저장.
- `src/preload/index.ts`: renderer용 `copyManager` API.
- `src/renderer/src/main.ts`: 검색·필터·그리드·카드 액션·모달·설정 적용.
- `src/renderer/src/scroll-remote.ts`: 스크롤 대상만 주입받는 독립 리모컨 컴포넌트.

## IPC 표면

- 조회: `app:get-info`, `history:get`, `settings:get`
- 창: `window:hide`, `window:toggle-aot`
- 항목: `clip:copy`, `clip:paste`, `item:pin`, `clip:delete`, `clip:clear`, `clip:reset`
- 설정: `settings:set`
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
