import { classifyToolAction } from '../lib/db/audit'

describe('classifyToolAction', () => {
  it('classifies create actions', () => {
    expect(classifyToolAction('hubspot_create_note')).toBe('CREATE')
    expect(classifyToolAction('hubspot_add_task')).toBe('CREATE')
  })

  it('classifies update actions', () => {
    expect(classifyToolAction('hubspot_update_crm_record')).toBe('UPDATE')
    expect(classifyToolAction('hubspot_edit_contact')).toBe('UPDATE')
  })

  it('classifies delete actions', () => {
    expect(classifyToolAction('hubspot_delete_crm_record')).toBe('DELETE')
    expect(classifyToolAction('hubspot_remove_note')).toBe('DELETE')
  })

  it('classifies read as default', () => {
    expect(classifyToolAction('hubspot_search_crm')).toBe('READ')
    expect(classifyToolAction('hubspot_get_crm_record')).toBe('READ')
    expect(classifyToolAction('hubspot_list_contacts')).toBe('READ')
  })
})
