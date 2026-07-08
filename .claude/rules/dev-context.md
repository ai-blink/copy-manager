# dev-context — copy-manager (즉시 재개 맥락 · 스냅샷)

## 환경
- OS: Windows 11 (전용 타깃)
- 런타임: Electron 42 + TypeScript 6(strict) (Node)
- 개발 셸: PowerShell 우선 (Bash 도구는 Unix 명령 필요 시만)

## 실행 명령
- 설치 `npm install` · 개발 `npm run dev`(electron-vite dev, HMR) · 빌드 `npm run build`
- 타입체크 `npm run typecheck`(tsc --noEmit) · 테스트 `npm test`(vitest, 15종) · 미리보기 `npm start`(preview)
- ⚠ dev 재시작 전 좀비 정리: `Get-Process electron | ? { $_.Path -like '*copy-manager*' } | Stop-Process -Force`
- ⚠ 창은 `show:false`로 시작 → 기동 후 **Ctrl+Alt+V**로 띄움

## 현재 상태 (2026-06-29)
- **S1~S5 전 슬라이스 코드 구현·실사용 검증·커밋 완료** (커밋 `21cabee` S4~S5, `456b15f` S1~S3).
- **보안: 화면 캡처 방지(D28) 구현·커밋 완료** (2026-06-29, 커밋 `578cda2`) — `setContentProtection` 기본 on + 설정 토글.
- **보안: 저장 암호화(D29) 구현·커밋 완료** (2026-06-29, 커밋 `f6e9913`) — `clip-history.json` safeStorage/DPAPI 암호화, `Cipher` 포트 주입(`src/main/cipher.ts`), 평문 자동 마이그레이션. test 17종 그린.
- **버그픽스: 프레임리스 창 드래그 이동** (2026-06-29, 커밋 `2ad140b`) — `.head`에 `-webkit-app-region: drag`, `.hbtn`에 no-drag.
- **스크롤 리모컨 on/off(D31) 구현·GUI 검증 완료** (2026-07-09) — 설정 `remoteEnabled`(기본 off, 옵트인) + `scroll-remote.ts` 핸들 `setVisible(on)`(off 시 진행 중 스크롤 정지+`display:none`). 설정 모달 체크박스(리모컨 그룹 상단)·`applySettings` 반영·구버전 settings.json 호환. typecheck·build·test 17종 그린 + dev 실동작 검증(기본 숨김·체크 토글로 표시/숨김) 성공.
- **자동 실행(D30) 구현** (2026-07-09, 미커밋) — 설정 `launchAtStartup`(기본 off) + `app.setLoginItemSettings`. 설정 모달 체크박스·`applyLaunchAtStartup` 부수효과·시작 시 동기화. dev(비패키징) 스킵. typecheck·build·test 17종 그린.
- **패키징 도입** (2026-07-09, 미커밋) — electron-builder 26(devDep) + `electron-builder.yml`(win NSIS·per-user·nut.js asarUnpack·npmRebuild off) + `npm run dist` 스크립트. `release\copy-manager Setup 0.1.0.exe`(100MB) + `win-unpacked` 산출. 패키징 exe 스모크 통과(크래시 없음·네이티브 로드 OK). `release/` gitignore. 자동실행 실제 등록(HKCU\Run)은 설치 후 GUI 체크로 수동 검증 필요.
- 남은 것:
  - **보안 후속(미구현)**: 2순위 = 민감 항목 미저장(Windows 클립보드 제외 마커 `ExcludeClipboardContentFromMonitorProcessing`·`CanIncludeInClipboardHistory` 존중 + 카드/시크릿 패턴 감지), 3순위 = 렌더러 CSP + 외부 내비게이션/`window.open` 차단. (실현성·범위는 다음 세션 시작 시 확인)
  - GUI 수동 검증 잔여(`notes/MANUAL-SMOKE.md` M4·M5·M7~M9 + M15~M24 + **M25~M28 캡처 방지 + M29~M31 저장 암호화**) + **1주 실사용 평가**("win+v보다 안 답답한가").
- 무관 잔여(미커밋): `CLAUDE.md` 거버넌스 추가분(Cross-Project Delivery Guard) — D28/D29와 무관해 제외해 둠.

## 핵심 파일
- 설계 정본: `notes/brainstorm/2026-06-28_copy-manager_design.md` · mockup: `notes/brainstorm/04_mockup.html`
- 코드: `src/main/`(창·핫키·캡처·붙여넣기·`cipher.ts` 암호화·IPC) · `src/shared/clipboard-store/`(+ `Cipher` 포트) · `src/shared/settings/` · `src/renderer/`(그리드·리모컨·모달·설정)
- 결정/로드맵/진행/피드백: `.claude/rules/dev-*.md`

## 확정 의존성 (구 inbox 후보 → 해소)
- 붙여넣기 합성: **@nut-tree-fork/nut-js** (D23)
- 저장: **로컬 JSON** (`clip-history.json` + `settings.json`), SQLite 후순위 (D21)
- 빌드: **electron-vite 5 + vite 7** (D19)
