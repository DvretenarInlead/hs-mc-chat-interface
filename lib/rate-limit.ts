// Simple in-memory rate limiter
// In production, use Upstash or Redis for distributed rate limiting

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const MAX_REQUESTS = 60 // per window
const WINDOW_MS = 60 * 1000 // 1 minute

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now >= entry.resetAt) {
    // Start new window
    const resetAt = now + WINDOW_MS
    rateLimitMap.set(userId, { count: 1, resetAt })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt }
}

// Periodically clean up expired entries
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((entry, key) => {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key)
    }
  })
}, 60 * 1000)
