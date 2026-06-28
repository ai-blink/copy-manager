# dev-arch — copy-manager (의도 아키텍처 · 코드 착수 전)

> 아직 코드 없음. 아래는 구현 시 목표 구조. 실제 파일 생기면 갱신.

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

## 모듈 경계 (예정)
- `clipboard-store` — 캡처·ring buffer·핀·영속화·타입 분류
- `scroll-remote` — **독립 컴포넌트**(전역판 분리 대비 느슨 결합): 입력=스크롤 대상 ref, 출력=scroll 명령
- `settings` — 영속 + "재부팅 시 기본값 리셋" 분기
- `paste` — 직전 포커스 앱 Ctrl+V 합성 (검증 대상)

## 보안/Electron 기본
- contextIsolation on, nodeIntegration off, preload로 최소 IPC 노출
