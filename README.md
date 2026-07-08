# copy-manager

Windows 11 `win+v`(클립보드 기록 창)의 불편을 해소하는 **개인용 데스크톱 클립보드 매니저**.

## 왜 만들었나 (win+v가 막히는 곳)

- 좁아서 한 번에 몇 개 안 보임 → 계속 스크롤해야 함
- 화살표로 아래 항목 보려다 **창이 닫힘**
- 좁은 스크롤바 조작 중 살짝 빗나가면(포커스 밖 클릭) **창이 닫힘**

→ **"보이는 개수가 적고, 탐색하다 창이 닫힌다"** 는 핵심 막힘을 해결한다.

## 주요 기능

- **카드 그리드**: 한 화면에 9개+(3×3, 2~5열 설정 가능), 4:3 균일 카드
- **키보드 탐색**: ←→↑↓ 그리드 이동 — **조작 중 창이 닫히지 않음**
- **클릭=복사 / Enter·더블클릭=직전 앱에 붙여넣기** (nut.js Ctrl+V 합성)
- **스크롤 리모컨**: 창 내부 플로팅(드웰 게이지·클릭/홀드·투명도) — 휠 없이 끝까지 탐색
- **타입 탭**: 전체/텍스트/이미지/링크/코드
- **핀 고정**: 핀 항목은 유지 개수 카운트 제외·영구 보존
- **전역 핫키**: 기본 `Ctrl+Alt+V` 토글(설정 변경 가능, win+v와 공존)
- **보안**: 화면 캡처 방지(`setContentProtection`) · 저장 암호화(safeStorage/DPAPI)
- **윈도우 시작 시 자동 실행**(옵트인)

## 스택

- Electron 42 + TypeScript 6(strict) · Vite(electron-vite 5) · vitest 4
- 렌더러 vanilla TS · 저장 로컬 JSON(`%APPDATA%\copy-manager\`)
- 붙여넣기 합성 `@nut-tree-fork/nut-js`
- Windows 전용

## 실행

```powershell
npm install        # 최초 1회
npm run dev        # 개발 실행(electron-vite dev, HMR) → Ctrl+Alt+V 로 창 열기
npm run build      # 프로덕션 번들
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run dist       # electron-builder 패키징(Windows NSIS) → release\
```

패키징 산출물: `release\copy-manager Setup <ver>.exe`(설치본) + `release\win-unpacked\copy-manager.exe`(무설치).
코드 서명이 없어 첫 실행 시 SmartScreen 경고가 뜰 수 있습니다(개인용, "추가 정보 → 실행"으로 진행).

## 범위 밖

전역(시스템 전체) 스크롤 리모컨(별도 프로젝트) · 클라우드 동기화 · 다국어 · `win+v` 강제 가로채기 · 크로스플랫폼(mac·Linux)
