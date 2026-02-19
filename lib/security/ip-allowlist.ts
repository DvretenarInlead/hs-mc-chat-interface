import { prisma } from '@/lib/db/prisma'

interface ParsedCidr {
  ip: number
  mask: number
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let num = 0
  for (const part of parts) {
    const n = parseInt(part, 10)
    if (isNaN(n) || n < 0 || n > 255) return null
    num = (num << 8) | n
  }
  return num >>> 0 // Ensure unsigned
}

function parseCidr(cidr: string): ParsedCidr | null {
  const trimmed = cidr.trim()
  const slashIdx = trimmed.indexOf('/')
  if (slashIdx === -1) {
    // Single IP
    const ip = ipToNumber(trimmed)
    if (ip === null) return null
    return { ip, mask: 0xFFFFFFFF }
  }
  const ipStr = trimmed.slice(0, slashIdx)
  const prefixLen = parseInt(trimmed.slice(slashIdx + 1), 10)
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null
  const ip = ipToNumber(ipStr)
  if (ip === null) return null
  const mask = prefixLen === 0 ? 0 : (0xFFFFFFFF << (32 - prefixLen)) >>> 0
  return { ip: (ip & mask) >>> 0, mask }
}

function ipMatchesCidr(clientIp: string, cidr: string): boolean {
  const clientNum = ipToNumber(clientIp)
  if (clientNum === null) return false
  const parsed = parseCidr(cidr)
  if (!parsed) return false
  return ((clientNum & parsed.mask) >>> 0) === parsed.ip
}

export async function isIpAllowed(clientIp: string): Promise<boolean> {
  // Load active allowlist entries
  const entries = await prisma.ipAllowlistEntry.findMany({
    where: { isActive: true },
  })

  // If no entries exist, IP allowlisting is disabled (allow all)
  if (entries.length === 0) return true

  // Check if client IP matches any entry
  for (const entry of entries) {
    if (ipMatchesCidr(clientIp, entry.cidr)) {
      return true
    }
  }

  return false
}

export function validateCidr(cidr: string): boolean {
  return parseCidr(cidr) !== null
}

export { ipMatchesCidr, parseCidr, ipToNumber }
