'use client'

interface ToolCallDisplayProps {
  toolName: string
  isActive?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  hubspot_search_crm: 'Searching CRM',
  hubspot_get_crm_record: 'Fetching record',
  hubspot_create_note: 'Creating note',
  hubspot_create_task: 'Creating task',
  hubspot_update_crm_record: 'Updating record',
}

export default function ToolCallDisplay({
  toolName,
  isActive = true,
}: ToolCallDisplayProps) {
  const label = TOOL_LABELS[toolName] || `Running ${toolName}`

  return (
    <div className="flex items-center gap-2 mb-3 px-4 py-2 bg-blue-50 rounded-lg text-sm text-blue-700 max-w-fit">
      {isActive && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span className="font-medium">{label}...</span>
    </div>
  )
}
