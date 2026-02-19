import { applyDataMasking, MaskingRule } from '../lib/security/data-masking'
import { MaskStyle } from '@prisma/client'

function makeRule(pattern: string, category: string, maskStyle: MaskStyle): MaskingRule {
  return {
    pattern: new RegExp(pattern, 'g'),
    category,
    maskStyle,
    name: `Test ${category}`,
  }
}

describe('applyDataMasking', () => {
  describe('email masking', () => {
    const rules = [makeRule('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', 'EMAIL', 'PARTIAL')]

    it('masks email with PARTIAL style', () => {
      const result = applyDataMasking('Contact john.doe@example.com for details', rules)
      expect(result).not.toContain('john.doe@example.com')
      expect(result).toContain('jo***@***.com')
    })

    it('masks multiple emails', () => {
      const result = applyDataMasking('alice@test.org and bob@corp.net', rules)
      expect(result).not.toContain('alice@test.org')
      expect(result).not.toContain('bob@corp.net')
    })

    it('leaves text without emails unchanged', () => {
      const text = 'No emails here, just text.'
      expect(applyDataMasking(text, rules)).toBe(text)
    })
  })

  describe('SSN masking', () => {
    const rules = [makeRule('\\b\\d{3}-\\d{2}-\\d{4}\\b', 'SSN', 'REDACT')]

    it('redacts SSN', () => {
      const result = applyDataMasking('SSN: 123-45-6789', rules)
      expect(result).toContain('[REDACTED SSN]')
      expect(result).not.toContain('123-45-6789')
    })
  })

  describe('credit card masking', () => {
    const rules = [makeRule('\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b', 'CREDIT_CARD', 'REDACT')]

    it('redacts credit card with dashes', () => {
      const result = applyDataMasking('Card: 4111-1111-1111-1111', rules)
      expect(result).toContain('[REDACTED CREDIT_CARD]')
      expect(result).not.toContain('4111')
    })
  })

  describe('phone masking', () => {
    const rules = [makeRule('(?:\\+1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}', 'PHONE', 'PARTIAL')]

    it('masks phone number partially', () => {
      const result = applyDataMasking('Call (555) 123-4567', rules)
      expect(result).not.toContain('(555) 123-4567')
      expect(result).toContain('4567') // Last 4 digits shown
    })
  })

  describe('FULL mask style', () => {
    const rules = [makeRule('SECRET_[A-Z0-9]+', 'API_KEY', 'FULL')]

    it('replaces with asterisks', () => {
      const result = applyDataMasking('Key: SECRET_ABC123XYZ', rules)
      expect(result).not.toContain('SECRET_ABC123XYZ')
      expect(result).toContain('***')
    })
  })

  describe('custom pattern', () => {
    const rules = [makeRule('ACCT-\\d{6}', 'CUSTOM', 'REDACT')]

    it('masks custom pattern', () => {
      const result = applyDataMasking('Account ACCT-123456 is active', rules)
      expect(result).toContain('[REDACTED CUSTOM]')
      expect(result).not.toContain('ACCT-123456')
    })
  })

  describe('multiple rules', () => {
    const rules = [
      makeRule('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', 'EMAIL', 'PARTIAL'),
      makeRule('\\b\\d{3}-\\d{2}-\\d{4}\\b', 'SSN', 'REDACT'),
    ]

    it('applies all rules', () => {
      const result = applyDataMasking('Email: john@test.com, SSN: 123-45-6789', rules)
      expect(result).not.toContain('john@test.com')
      expect(result).not.toContain('123-45-6789')
      expect(result).toContain('[REDACTED SSN]')
    })
  })

  describe('edge cases', () => {
    it('handles empty text', () => {
      expect(applyDataMasking('', [])).toBe('')
    })

    it('handles no rules', () => {
      expect(applyDataMasking('some text', [])).toBe('some text')
    })

    it('handles null-ish inputs', () => {
      expect(applyDataMasking('', [makeRule('.', 'CUSTOM', 'FULL')])).toBe('')
    })
  })
})
