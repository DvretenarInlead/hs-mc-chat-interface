// Test confirmation token HMAC signing
// We need to set SESSION_SECRET for the tests to work
process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long'

import { generateConfirmationToken, verifyConfirmationToken } from '../lib/claude/tool-handler'

describe('Confirmation tokens', () => {
  it('generates and verifies valid tokens', () => {
    const token = generateConfirmationToken('hubspot_create_note', { body: 'test' })
    const result = verifyConfirmationToken(token)
    expect(result).not.toBeNull()
    expect(result?.tool).toBe('hubspot_create_note')
    expect(result?.input).toEqual({ body: 'test' })
  })

  it('rejects tampered tokens', () => {
    const token = generateConfirmationToken('hubspot_create_note', { body: 'test' })
    // Tamper with the signature
    const tampered = token.slice(0, -4) + 'xxxx'
    const result = verifyConfirmationToken(tampered)
    expect(result).toBeNull()
  })

  it('rejects tokens without a signature', () => {
    const payload = Buffer.from(JSON.stringify({
      tool: 'hubspot_create_note',
      input: {},
      ts: Date.now(),
    })).toString('base64')
    const result = verifyConfirmationToken(payload)
    expect(result).toBeNull()
  })

  it('rejects malformed tokens', () => {
    expect(verifyConfirmationToken('')).toBeNull()
    expect(verifyConfirmationToken('not.valid.token')).toBeNull()
    expect(verifyConfirmationToken('abc')).toBeNull()
  })
})
