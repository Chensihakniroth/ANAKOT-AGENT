// Chat messages — ported from Hermes
export function formatChatMessage(message: { role: string; content: string }): string {
  return message.content
}