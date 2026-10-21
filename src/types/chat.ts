export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface CustomMedia {
  id: string;
  name: string;
  type: 'emoji' | 'gif';
  url: string;
  shape?: 'square' | 'circle' | 'rounded' | 'original';
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId?: string; // 'main' or 'dm:User1:User2'
  userId: string;
  sender: string;
  recipient?: string; // For DMs
  content: string;
  type?: 'text' | 'gif';
  mediaUrl?: string;
  createdAt: string;
  reactions?: Record<string, string[]>; // emoji -> array of usernames
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface AuthStatusResponse {
  approvedNames: string[];
  registeredNames: string[];
  availableNames: string[];
}

export type WSClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'send_message'; content: string; channelId?: string; recipient?: string; msgType?: 'text' | 'gif'; mediaUrl?: string }
  | { type: 'toggle_reaction'; messageId: string; emoji: string }
  | { type: 'delete_message'; messageId: string }
  | { type: 'ping' };

export type WSServerMessage =
  | { type: 'init'; messages: ChatMessage[]; onlineUsers: string[]; customMedia: CustomMedia[] }
  | { type: 'new_message'; message: ChatMessage }
  | { type: 'message_reaction'; messageId: string; reactions: Record<string, string[]> }
  | { type: 'message_deleted'; messageId: string; channelId?: string }
  | { type: 'presence'; onlineUsers: string[] }
  | { type: 'user_registered'; username: string; availableNames: string[]; registeredNames: string[] }
  | { type: 'custom_media_added'; media: CustomMedia }
  | { type: 'error'; message: string }
  | { type: 'pong' };
