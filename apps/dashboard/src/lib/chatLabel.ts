export interface ChatIdentity {
  id: string;
  is_group?: boolean;
  display_name?: string | null;
  phone?: string | null;
}

export function chatLabel(chat: ChatIdentity): string {
  if (chat.display_name) return chat.display_name;
  if (chat.phone) return `+${chat.phone}`;
  if (chat.id.endsWith('@s.whatsapp.net')) return `+${chat.id.split('@')[0]}`;
  if (chat.is_group) return `Grupo sin nombre · ${chat.id.split('@')[0]}`;
  if (chat.id.endsWith('@lid')) return `Contacto sin nombre · LID ${chat.id.split('@')[0]}`;
  return chat.id;
}

