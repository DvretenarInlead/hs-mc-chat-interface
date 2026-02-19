import { encrypt, decrypt } from '@/lib/auth/encryption'

/**
 * Encrypt chat messages JSON before storing in the database.
 * Uses the same AES-256-GCM encryption as HubSpot tokens.
 */
export function encryptChatMessages(messages: unknown[]): string {
  const json = JSON.stringify(messages)
  return encrypt(json)
}

/**
 * Decrypt chat messages from the database.
 * Returns the parsed JSON array, or the raw value if not encrypted.
 */
export function decryptChatMessages(stored: unknown, isEncrypted: boolean): unknown[] {
  if (!isEncrypted) {
    // Legacy unencrypted — return as-is
    if (Array.isArray(stored)) return stored
    if (typeof stored === 'string') {
      try {
        return JSON.parse(stored)
      } catch {
        return []
      }
    }
    return []
  }

  if (typeof stored !== 'string') return []

  try {
    const decrypted = decrypt(stored)
    return JSON.parse(decrypted)
  } catch {
    console.error('Failed to decrypt chat messages')
    return []
  }
}
