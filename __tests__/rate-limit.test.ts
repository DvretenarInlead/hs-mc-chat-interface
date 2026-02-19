import { checkRateLimit } from '../lib/rate-limit'

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('test-user-unique-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(59)
  })

  it('decrements remaining count', () => {
    const userId = 'test-user-unique-2'
    checkRateLimit(userId)
    const result = checkRateLimit(userId)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(58)
  })

  it('blocks after exceeding limit', () => {
    const userId = 'test-user-flood'
    for (let i = 0; i < 60; i++) {
      checkRateLimit(userId)
    }
    const result = checkRateLimit(userId)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
