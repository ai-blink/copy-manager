import type { ClipType } from './types'

// 텍스트 콘텐츠를 link / code / text 로 분류 (image 는 캡처 시점에 명시 지정).
// 순수 함수 — 외부 의존 없음.

const URL_RE = /^https?:\/\/[^\s]+$/i

const CODE_SIGNALS: readonly RegExp[] = [
  /[;{}]\s*$/m, // 줄 끝 세미콜론 / 중괄호
  /\b(function|const|let|var|class|import|export|def|return|public|private|void)\b/,
  /=>/,
  /^\s*(#include|#define|package\s|using\s)/m,
  /^\s{2,}\S/m // 들여쓰기 라인
]

function looksLikeCode(s: string): boolean {
  const hits = CODE_SIGNALS.reduce((n, re) => (re.test(s) ? n + 1 : n), 0)
  const multiline = s.includes('\n')
  return hits >= 2 || (multiline && hits >= 1)
}

/** 텍스트 내용 기반 타입 분류. 빈 문자열은 'text'. */
export function classifyText(content: string): ClipType {
  const trimmed = content.trim()
  if (trimmed.length === 0) return 'text'
  if (URL_RE.test(trimmed)) return 'link'
  if (looksLikeCode(trimmed)) return 'code'
  return 'text'
}
