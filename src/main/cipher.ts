import { safeStorage } from 'electron'
import type { Cipher } from '../shared/clipboard-store'

// D29 — 영속 데이터 암호화(저장소 유출 방지).
// Windows safeStorage 는 DPAPI(현재 사용자 계정에 묶임)를 사용 → 파일을 통째로 빼가도
// 다른 계정/머신에서는 복호화 불가. clipboard-store 는 electron 비의존이라 이 cipher 를 주입한다.

interface EncEnvelope {
  v: 2
  alg: 'safeStorage'
  /** safeStorage.encryptString 결과(Buffer)의 base64 */
  data: string
}

/**
 * safeStorage(DPAPI) 기반 Cipher 생성.
 * - DPAPI 미가용 환경(드묾)은 평문 폴백 + 경고(데이터 손실 방지).
 * - decrypt 는 구 평문 파일(version:1 + items)도 그대로 통과 → 첫 save 때 자동 암호화 마이그레이션.
 * - 반드시 app ready 이후 호출(safeStorage 제약).
 */
export function createSafeStorageCipher(): Cipher {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[copy-manager] safeStorage 암호화 불가(DPAPI 미가용) — 클립보드 기록이 평문으로 저장됩니다.')
    return {
      encrypt: (plain) => plain,
      decrypt: (stored) => stored
    }
  }

  return {
    encrypt(plain: string): string {
      const data = safeStorage.encryptString(plain).toString('base64')
      const env: EncEnvelope = { v: 2, alg: 'safeStorage', data }
      return JSON.stringify(env)
    },
    decrypt(stored: string): string {
      let env: Partial<EncEnvelope>
      try {
        env = JSON.parse(stored) as Partial<EncEnvelope>
      } catch {
        return stored // JSON 파싱 불가 → 그대로 반환(이론상 발생 안 함)
      }
      if (env && env.alg === 'safeStorage' && typeof env.data === 'string') {
        return safeStorage.decryptString(Buffer.from(env.data, 'base64'))
      }
      return stored // 구 평문 포맷(version:1 + items) → 그대로 통과(마이그레이션)
    }
  }
}
