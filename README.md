# copy-manager

Windows 11 `win+v`보다 더 많은 클립보드 기록을 한눈에 보고, 탐색 중 창이 닫히지 않도록 만든 개인용 데스크톱 클립보드 매니저입니다.

## 해결하려는 문제

- `win+v`는 창이 좁아 한 번에 보이는 기록이 적습니다.
- 화살표 탐색이나 스크롤바 조작 중 포커스를 잃으면 창이 닫힐 수 있습니다.
- 마우스 휠 없이 긴 기록을 탐색하기 어렵습니다.

copy-manager는 넓은 카드 그리드, 유지되는 창, 키보드 탐색과 창 내부 스크롤 리모컨으로 이 불편을 줄입니다.

## 주요 기능

- 카드 2~8열과 전체 UI 배율 75~150%
- `←→↑↓` 키보드 탐색, 검색, 전체/텍스트/이미지/링크/코드 필터와 현재 결과/최대 보유 개수 표시
- 클릭하면 복사, `Enter`·더블클릭하면 직전 앱에 붙여넣기
- 핀 항목 영구 보존과 기본 100개 히스토리(1~1000개 설정, 빠른 값 선택)
- 핀을 보존하는 중복 클립보드 일괄 제거
- 창 내부 플로팅 스크롤 리모컨(옵트인, 드웰 또는 클릭/홀드)
- 기본 `Ctrl+Alt+V` 전역 단축키, 항상 위 토글, 선택적 자동 숨김
- 단축키를 보조키 2개와 실행 키의 세 콤보박스로 설정하며, 다른 앱과 충돌하면 경고 후 기존 단축키 유지
- 9분할 창 배치와 드래그 위치 복원
- 화면 캡처 방지와 `safeStorage`/Windows DPAPI 기반 히스토리 암호화
- Windows 시작 시 자동 실행(옵트인, 패키징 앱에서만 적용)
- 왼쪽 사이드바 탭으로 구분한 설정(일반·창/표시·히스토리·리모컨·보안)

## 설치와 실행

### 패키징 앱

- 설치본: `release\copy-manager Setup 0.2.2.exe`
- 무설치본: `release\win-unpacked\copy-manager.exe`

코드 서명이 없어 첫 실행 시 SmartScreen 경고가 나타날 수 있습니다. 최신 공개 산출물은 [GitHub Releases](https://github.com/ai-blink/copy-manager/releases/tag/v0.2.2)에서 받을 수 있습니다.

### 개발 실행

```powershell
npm install
npm run dev
```

앱은 숨김 상태로 시작합니다. `Ctrl+Alt+V`를 눌러 창을 엽니다.

## 개발 명령

```powershell
npm run typecheck  # TypeScript strict 검사
npm test           # Vitest 단위테스트 21개
npm run build      # main/preload/renderer 번들
npm run dist       # Windows NSIS 설치본과 무설치본 생성
```

## 저장 위치와 보안

- 저장 위치: `%APPDATA%\copy-manager\`
- `clip-history.json`: `safeStorage`/Windows DPAPI 암호화
- `settings.json`: 핫키·토글 등 비민감 설정을 평문 저장
- 화면 캡처 방지는 소프트웨어 캡처 노출을 줄이지만 RDP·일부 가상화 환경·물리 카메라까지 보장하지 않습니다.

## 현재 상태와 문서

- 최신 버전: `0.2.2`
- S1~S6 코드 구현과 자동 검증 완료
- GUI 수동 검증과 1주 실사용 평가는 진행 전/진행 중

변경 내역은 [CHANGELOG.md](CHANGELOG.md), 수동 검증 절차는 [notes/MANUAL-SMOKE.md](notes/MANUAL-SMOKE.md), 현재 개발 상태는 [rules/dev-context.md](rules/dev-context.md)를 참고하세요.

## 범위 밖

전역 시스템 스크롤 리모컨 · 클라우드 동기화 · 다국어 · `win+v` 강제 가로채기 · macOS/Linux
