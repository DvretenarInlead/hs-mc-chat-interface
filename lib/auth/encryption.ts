import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_SALT = 'ri-token-encryption-v1' // Static salt — key uniqueness comes from the secret

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set (32+ character random string)')
  }
  // Derive a 32-byte key using PBKDF2 with SHA-512
  cachedKey = pbkdf2Sync(key, PBKDF2_SALT, PBKDF2_ITERATIONS, 32, 'sha512')
  return cachedKey
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
