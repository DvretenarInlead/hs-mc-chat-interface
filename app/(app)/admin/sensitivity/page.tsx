import SensitivityRuleEditor from '@/components/admin/SensitivityRuleEditor'

export default function SensitivityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Sensitivity Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure automatic masking of sensitive data (emails, phone numbers, SSNs, etc.) in chat responses.
          Built-in rules can be toggled but not deleted.
        </p>
      </div>
      <SensitivityRuleEditor />
    </div>
  )
}
