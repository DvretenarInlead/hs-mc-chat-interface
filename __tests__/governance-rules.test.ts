import { isWriteOperation } from '../lib/governance/rules'

describe('isWriteOperation', () => {
  it('detects create operations', () => {
    expect(isWriteOperation('hubspot_create_note')).toBe(true)
    expect(isWriteOperation('hubspot_create_task')).toBe(true)
  })

  it('detects update operations', () => {
    expect(isWriteOperation('hubspot_update_crm_record')).toBe(true)
  })

  it('detects delete operations', () => {
    expect(isWriteOperation('hubspot_delete_crm_record')).toBe(true)
  })

  it('detects add operations', () => {
    expect(isWriteOperation('hubspot_add_note')).toBe(true)
  })

  it('returns false for read operations', () => {
    expect(isWriteOperation('hubspot_search_crm')).toBe(false)
    expect(isWriteOperation('hubspot_get_crm_record')).toBe(false)
    expect(isWriteOperation('hubspot_list_contacts')).toBe(false)
  })
})
