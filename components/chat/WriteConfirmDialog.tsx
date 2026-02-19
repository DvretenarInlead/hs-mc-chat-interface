'use client'

import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface WriteConfirmDialogProps {
  isOpen: boolean
  toolName: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export default function WriteConfirmDialog({
  isOpen,
  toolName,
  description,
  onConfirm,
  onCancel,
}: WriteConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Confirm Action">
      <div className="space-y-4">
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-sm text-yellow-800 font-medium mb-1">
            Write operation requested
          </p>
          <p className="text-sm text-yellow-700">{description}</p>
        </div>

        <p className="text-sm text-gray-600">
          Tool: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{toolName}</code>
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  )
}
