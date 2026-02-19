import { validatePinFormat, hashPin, verifyPin } from '../lib/auth/pin'

describe('validatePinFormat', () => {
  it('accepts valid 4-digit PIN', () => {
    expect(validatePinFormat('1397')).toEqual({ valid: true })
  })

  it('accepts valid 6-digit PIN', () => {
    expect(validatePinFormat('482917')).toEqual({ valid: true })
  })

  it('accepts valid 8-digit PIN', () => {
    expect(validatePinFormat('19283746')).toEqual({ valid: true })
  })

  it('rejects too short PIN', () => {
    const result = validatePinFormat('123')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('4-8')
  })

  it('rejects too long PIN', () => {
    const result = validatePinFormat('123456789')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('4-8')
  })

  it('rejects non-digit characters', () => {
    const result = validatePinFormat('12ab')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('digits')
  })

  it('rejects all same digit', () => {
    const result = validatePinFormat('1111')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('same digit')
  })

  it('rejects sequential ascending', () => {
    const result = validatePinFormat('1234')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('sequential')
  })

  it('rejects sequential descending', () => {
    const result = validatePinFormat('4321')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('sequential')
  })
})

describe('hashPin / verifyPin', () => {
  it('verifies correct PIN', () => {
    const hash = hashPin('5829')
    expect(verifyPin('5829', hash)).toBe(true)
  })

  it('rejects wrong PIN', () => {
    const hash = hashPin('5829')
    expect(verifyPin('5830', hash)).toBe(false)
  })

  it('generates unique hashes (different salts)', () => {
    const hash1 = hashPin('5829')
    const hash2 = hashPin('5829')
    expect(hash1).not.toBe(hash2) // Different salts
    // But both should verify
    expect(verifyPin('5829', hash1)).toBe(true)
    expect(verifyPin('5829', hash2)).toBe(true)
  })

  it('returns false for malformed hash', () => {
    expect(verifyPin('1234', 'not-a-valid-hash')).toBe(false)
    expect(verifyPin('1234', '')).toBe(false)
  })
})
