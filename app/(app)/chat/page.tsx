import ChatWindow from '@/components/chat/ChatWindow'
import ChatPinGate from '@/components/chat/ChatPinGate'

export default function ChatPage() {
  return (
    <ChatPinGate>
      <ChatWindow />
    </ChatPinGate>
  )
}
