/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AuthStatusResponse, ChatMessage, CustomMedia, User, WSServerMessage } from './types/chat.ts';
import { APPROVED_NAMES } from './config/whitelist.ts';
import { Header } from './components/Header.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { ChatArea } from './components/ChatArea.tsx';
import { MessageInput } from './components/MessageInput.tsx';
import { OnlineMembersDrawer } from './components/OnlineMembersDrawer.tsx';
import { CropMediaModal } from './components/CropMediaModal.tsx';
import { DiscordSidebar } from './components/DiscordSidebar.tsx';
import { AvatarSettingsModal } from './components/AvatarSettingsModal.tsx';
import { CameraCaptureModal } from './components/CameraCaptureModal.tsx';
import { AvatarCropperModal } from './components/AvatarCropperModal.tsx';
import { Toast, type ToastMessage } from './components/Toast.tsx';
import type { CropShape } from './utils/gifConverter.ts';
import { loadVault, saveVault, syncVaultWithServer } from './utils/storageVault.ts';

const TOKEN_KEY = '67_gang_session_token';
const LAST_READ_KEY = '67_gang_last_read_map';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({
    approvedNames: [...APPROVED_NAMES],
    registeredNames: [],
    availableNames: [...APPROVED_NAMES],
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [customMedia, setCustomMedia] = useState<CustomMedia[]>([]);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isOnlineDrawerOpen, setIsOnlineDrawerOpen] = useState<boolean>(false);

  // Avatar Management Modal states
  const [isAvatarSettingsOpen, setIsAvatarSettingsOpen] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cropperState, setCropperState] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
  }>({
    isOpen: false,
    imageSrc: null,
  });
  const [isSavingAvatar, setIsSavingAvatar] = useState<boolean>(false);
  const [isResettingAvatar, setIsResettingAvatar] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Active channel: 'main' for 67 Gang Chat, or friend's username for private DM
  const [activeChannel, setActiveChannel] = useState<'main' | string>('main');

  // Typing indicator state per channel
  const [typingUsersMap, setTypingUsersMap] = useState<{ [channelId: string]: string[] }>({});
  const typingTimersRef = useRef<{ [key: string]: number }>({});

  // Last read timestamp per channel
  const [lastReadMap, setLastReadMap] = useState<{ [key: string]: string }>(() => {
    try {
      const stored = localStorage.getItem(LAST_READ_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Track the first unread message ID when entering a channel
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  // Upload & Crop Modal state
  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    file: File | null;
    mediaType: 'emoji' | 'gif';
  }>({
    isOpen: false,
    file: null,
    mediaType: 'emoji',
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  // Computed custom emojis and GIFs
  const customEmojis = useMemo(() => customMedia.filter((m) => m.type === 'emoji'), [customMedia]);
  const customGifs = useMemo(() => customMedia.filter((m) => m.type === 'gif'), [customMedia]);

  // Save last read to localStorage
  const updateLastRead = useCallback((channel: string) => {
    const now = new Date().toISOString();
    setLastReadMap((prev) => {
      const updated = { ...prev, [channel]: now };
      localStorage.setItem(LAST_READ_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Filter messages for current active channel
  const currentChannelMessages = useMemo(() => {
    if (!currentUser) return [];
    const myName = currentUser.username.toLowerCase();

    if (activeChannel === 'main') {
      return messages.filter((m) => !m.channelId || m.channelId === 'main');
    }

    // Direct message with a classmate
    const friendName = activeChannel.toLowerCase();
    return messages.filter((m) => {
      if (!m.channelId || m.channelId === 'main') return false;
      const sender = m.sender.toLowerCase();
      const recipient = (m.recipient || '').toLowerCase();
      return (
        (sender === myName && recipient === friendName) ||
        (sender === friendName && recipient === myName) ||
        m.channelId.includes(friendName)
      );
    });
  }, [messages, activeChannel, currentUser]);

  // Compute unread counts for all channels (67 Gang and each classmate)
  const unreadCounts = useMemo(() => {
    if (!currentUser) return {};
    const myName = currentUser.username.toLowerCase();
    const counts: { [key: string]: number } = {};

    messages.forEach((m) => {
      if (m.sender.toLowerCase() === myName) return; // My own messages are read

      if (!m.channelId || m.channelId === 'main') {
        const lastRead = lastReadMap['main'] || '1970-01-01T00:00:00Z';
        if (m.createdAt > lastRead) {
          counts['main'] = (counts['main'] || 0) + 1;
        }
      } else {
        // DM message from classmate
        const sender = m.sender;
        const lastRead = lastReadMap[sender] || '1970-01-01T00:00:00Z';
        if (m.createdAt > lastRead) {
          counts[sender] = (counts[sender] || 0) + 1;
        }
      }
    });

    return counts;
  }, [messages, currentUser, lastReadMap]);

  // Determine first unread message when switching channels
  useEffect(() => {
    if (!currentUser) return;
    const lastRead = lastReadMap[activeChannel] || '1970-01-01T00:00:00Z';
    const firstUnread = currentChannelMessages.find(
      (m) =>
        m.sender.toLowerCase() !== currentUser.username.toLowerCase() &&
        m.createdAt > lastRead
    );
    setFirstUnreadId(firstUnread ? firstUnread.id : null);

    // Mark as read after 3 seconds of viewing
    const timer = setTimeout(() => {
      updateLastRead(activeChannel);
    }, 2500);

    return () => clearTimeout(timer);
  }, [activeChannel, currentChannelMessages, currentUser, lastReadMap, updateLastRead]);

  // Ensure activeChannel reverts to 'main' if the DM user does not actually exist yet
  useEffect(() => {
    if (activeChannel !== 'main') {
      const exists = authStatus.registeredNames.some(
        (name) => name.toLowerCase() === activeChannel.toLowerCase()
      );
      if (!exists) {
        setActiveChannel('main');
      }
    }
  }, [activeChannel, authStatus.registeredNames]);

  // 1. Fetch Auth Status
  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
        return;
      }
    } catch {
      // Offline / GitHub Pages fallback
    }

    const vault = loadVault();
    const registered = Array.from(
      new Set([
        ...vault.registeredNames,
        ...Object.values(vault.savedAccounts).map((a) => a.username),
        ...(vault.currentUser ? [vault.currentUser.username] : []),
      ])
    );
    const available = APPROVED_NAMES.filter((name) => !registered.includes(name));
    setAuthStatus({
      approvedNames: [...APPROVED_NAMES],
      registeredNames: registered,
      availableNames: available,
    });
  }, []);

  // 2. Fetch Initial Messages via REST
  const fetchMessages = useCallback(async (authToken: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          return;
        }
      }
    } catch {
      // Offline / GitHub Pages fallback
    } finally {
      setIsLoadingMessages(false);
    }

    const vault = loadVault();
    if (vault.messages.length > 0) {
      setMessages(vault.messages);
    }
  }, []);

  // 3. Fetch Custom Media
  const fetchCustomMedia = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/media', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.all)) {
          setCustomMedia(data.all);
          return;
        }
      }
    } catch {
      // Offline / GitHub Pages fallback
    }

    const vault = loadVault();
    if (vault.customMedia.length > 0) {
      setCustomMedia(vault.customMedia);
    }
  }, []);

  // Fetch All User Avatars
  const fetchAvatars = useCallback(async () => {
    try {
      const res = await fetch('/api/users/avatars');
      if (res.ok) {
        const data = await res.json();
        if (data.avatars) {
          setUserAvatars(data.avatars);
          return;
        }
      }
    } catch {
      // Offline / GitHub Pages fallback
    }

    const vault = loadVault();
    const map: Record<string, string> = {};
    if (vault.currentUser?.avatar) {
      map[vault.currentUser.username.toLowerCase()] = vault.currentUser.avatar;
    }
    for (const acc of Object.values(vault.savedAccounts)) {
      if ((acc as { avatar?: string }).avatar) {
        map[acc.username.toLowerCase()] = (acc as { avatar?: string }).avatar!;
      }
    }
    setUserAvatars(map);
  }, []);

  // 4. Connect to WebSocket Server
  const connectWebSocket = useCallback((authToken: string) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(authToken)}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const payload: WSServerMessage = JSON.parse(event.data);

          if (payload.type === 'init') {
            if (Array.isArray(payload.messages)) {
              setMessages(payload.messages);
            }
            if (Array.isArray(payload.onlineUsers)) {
              setOnlineUsers(payload.onlineUsers);
            }
            if (Array.isArray(payload.customMedia)) {
              setCustomMedia(payload.customMedia);
            }
            if (payload.userAvatars) {
              setUserAvatars(payload.userAvatars);
            }
          } else if (payload.type === 'new_message') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.message.id)) return prev;
              return [...prev, payload.message];
            });
          } else if (payload.type === 'message_reaction') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
              )
            );
          } else if (payload.type === 'message_deleted') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
          } else if (payload.type === 'user_avatar_updated') {
            setUserAvatars((prev) => {
              const updated = { ...prev };
              if (payload.avatar) {
                updated[payload.username.toLowerCase()] = payload.avatar;
              } else {
                delete updated[payload.username.toLowerCase()];
              }
              return updated;
            });
            setCurrentUser((prev) => {
              if (prev && prev.username.toLowerCase() === payload.username.toLowerCase()) {
                return { ...prev, avatar: payload.avatar || null };
              }
              return prev;
            });
          } else if (payload.type === 'typing') {
            const ch = payload.channelId || 'main';
            const username = payload.username;
            if (currentUser && username.toLowerCase() === currentUser.username.toLowerCase()) {
              return;
            }

            const timerKey = `${ch}:${username.toLowerCase()}`;
            if (typingTimersRef.current[timerKey]) {
              clearTimeout(typingTimersRef.current[timerKey]);
            }

            if (payload.isTyping) {
              setTypingUsersMap((prev) => {
                const currentList = prev[ch] || [];
                if (currentList.some((u) => u.toLowerCase() === username.toLowerCase())) {
                  return prev;
                }
                return { ...prev, [ch]: [...currentList, username] };
              });

              typingTimersRef.current[timerKey] = window.setTimeout(() => {
                setTypingUsersMap((prev) => ({
                  ...prev,
                  [ch]: (prev[ch] || []).filter((u) => u.toLowerCase() !== username.toLowerCase()),
                }));
              }, 4000);
            } else {
              setTypingUsersMap((prev) => ({
                ...prev,
                [ch]: (prev[ch] || []).filter((u) => u.toLowerCase() !== username.toLowerCase()),
              }));
            }
          } else if (payload.type === 'presence') {
            if (Array.isArray(payload.onlineUsers)) {
              setOnlineUsers(payload.onlineUsers);
            }
          } else if (payload.type === 'user_registered') {
            fetchAuthStatus();
          } else if (payload.type === 'custom_media_added') {
            setCustomMedia((prev) => {
              if (prev.some((m) => m.id === payload.media.id)) return prev;
              return [payload.media, ...prev];
            });
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (localStorage.getItem(TOKEN_KEY)) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectWebSocket(authToken);
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('WebSocket connection initialization failed:', err);
    }
  }, [fetchAuthStatus]);

  // 5. Initial Auth Check with Auto-Heal Resilience
  useEffect(() => {
    async function checkAuth() {
      const vault = loadVault();

      // Proactively sync vault to server on mount so server restores any accounts/messages
      if (
        vault.currentUser ||
        Object.keys(vault.savedAccounts).length > 0 ||
        vault.messages.length > 0 ||
        vault.customMedia.length > 0
      ) {
        try {
          await syncVaultWithServer(vault);
        } catch {
          // ignore network error
        }
      }

      await fetchAuthStatus();

      const savedToken = localStorage.getItem(TOKEN_KEY) || vault.token;

      if (!savedToken) {
        setIsLoadingAuth(false);
        return;
      }

      let verifiedUser: User | null = null;

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          verifiedUser = data.user;
        }
      } catch (err) {
        console.warn('Initial session check failed:', err);
      }

      // If server doesn't know user (e.g. server restarted or container cold-started), auto-restore from vault!
      if (!verifiedUser && (vault.currentUser || Object.keys(vault.savedAccounts).length > 0)) {
        console.log('[67 Gang Vault] Server restarted or missing session; auto-restoring from local vault...');
        await syncVaultWithServer(vault);
        try {
          const retryRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            verifiedUser = data.user;
          }
        } catch (err) {
          console.warn('Retry auth failed:', err);
        }
      }

      if (verifiedUser) {
        setCurrentUser(verifiedUser);
        setToken(savedToken);
        fetchMessages(savedToken);
        fetchCustomMedia(savedToken);
        fetchAvatars();
        connectWebSocket(savedToken);
        saveVault({ currentUser: verifiedUser, token: savedToken });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setCurrentUser(null);
      }

      setIsLoadingAuth(false);
    }

    checkAuth();

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [fetchAuthStatus, fetchMessages, fetchCustomMedia, fetchAvatars, connectWebSocket]);

  // Backup messages and custom media to vault whenever they update
  useEffect(() => {
    if (messages.length > 0) {
      saveVault({ messages });
    }
  }, [messages]);

  useEffect(() => {
    if (customMedia.length > 0) {
      saveVault({ customMedia });
    }
  }, [customMedia]);

  // Active typing users for current channel (excluding oneself)
  const currentTypingUsers = useMemo(() => {
    const list = typingUsersMap[activeChannel] || [];
    if (!currentUser) return list;
    return list.filter((u) => u.toLowerCase() !== currentUser.username.toLowerCase());
  }, [typingUsersMap, activeChannel, currentUser]);

  // Send typing event
  const handleSendTyping = useCallback(
    (isTyping: boolean) => {
      if (!currentUser) return;
      const ch = activeChannel;

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'typing',
            channelId: ch,
            isTyping,
          })
        );
      }

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('67_gang_typing');
          bc.postMessage({
            type: 'typing',
            username: currentUser.username,
            channelId: ch,
            isTyping,
          });
          bc.close();
        }
      } catch {}
    },
    [currentUser, activeChannel]
  );

  // BroadcastChannel listener for multi-tab sync (messages & typing)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const typingBc = new BroadcastChannel('67_gang_typing');
    const msgBc = new BroadcastChannel('67_gang_messages');

    typingBc.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'typing' && data.username) {
        if (currentUser && data.username.toLowerCase() === currentUser.username.toLowerCase()) return;
        const ch = data.channelId || 'main';
        const timerKey = `${ch}:${data.username.toLowerCase()}`;
        if (typingTimersRef.current[timerKey]) {
          clearTimeout(typingTimersRef.current[timerKey]);
        }

        if (data.isTyping) {
          setTypingUsersMap((prev) => {
            const currentList = prev[ch] || [];
            if (currentList.some((u) => u.toLowerCase() === data.username.toLowerCase())) {
              return prev;
            }
            return { ...prev, [ch]: [...currentList, data.username] };
          });
          typingTimersRef.current[timerKey] = window.setTimeout(() => {
            setTypingUsersMap((prev) => ({
              ...prev,
              [ch]: (prev[ch] || []).filter((u) => u.toLowerCase() !== data.username.toLowerCase()),
            }));
          }, 4000);
        } else {
          setTypingUsersMap((prev) => ({
            ...prev,
            [ch]: (prev[ch] || []).filter((u) => u.toLowerCase() !== data.username.toLowerCase()),
          }));
        }
      }
    };

    msgBc.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'new_message' && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    };

    return () => {
      typingBc.close();
      msgBc.close();
    };
  }, [currentUser]);

  // Handle Login/Register Success
  const handleLoginSuccess = (newToken: string, user: User, salt?: string, hash?: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setCurrentUser(user);
    saveVault({
      currentUser: user,
      token: newToken,
      accountSalt: salt,
      accountHash: hash,
    });
    fetchAuthStatus();
    fetchMessages(newToken);
    fetchCustomMedia(newToken);
    fetchAvatars();
    connectWebSocket(newToken);
    updateLastRead('main');
  };

  // Handle Logout
  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    localStorage.removeItem(TOKEN_KEY);
    saveVault({ currentUser: null, token: null });
    setToken(null);
    setCurrentUser(null);
    setMessages([]);
    setOnlineUsers([]);
    setCustomMedia([]);
    setIsConnected(false);
    fetchAuthStatus();
  };

  // Send Message
  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!token || !currentUser) return false;

    const channelId = activeChannel === 'main' ? 'main' : undefined;
    const recipient = activeChannel === 'main' ? undefined : activeChannel;

    updateLastRead(activeChannel);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          content,
          channelId,
          recipient,
          msgType: 'text',
        })
      );
      return true;
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, channelId, recipient, msgType: 'text' }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        return true;
      }
    } catch {
      // Offline / GitHub Pages static fallback
    }

    const localMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      channelId: channelId || 'main',
      userId: currentUser.id,
      sender: currentUser.username,
      recipient,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localMsg]);
    saveVault({ messages: [localMsg] });
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('67_gang_messages');
        bc.postMessage({ type: 'new_message', message: localMsg });
        bc.close();
      }
    } catch {}
    return true;
  };

  // Send GIF
  const handleSendGif = async (mediaUrl: string, name?: string): Promise<boolean> => {
    if (!token || !currentUser) return false;

    const caption = name ? `:${name}:` : 'GIF';
    const channelId = activeChannel === 'main' ? 'main' : undefined;
    const recipient = activeChannel === 'main' ? undefined : activeChannel;

    updateLastRead(activeChannel);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          content: caption,
          channelId,
          recipient,
          msgType: 'gif',
          mediaUrl,
        })
      );
      return true;
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: caption, channelId, recipient, msgType: 'gif', mediaUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        return true;
      }
    } catch {
      // Offline / GitHub Pages static fallback
    }

    const localMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      channelId: channelId || 'main',
      userId: currentUser.id,
      sender: currentUser.username,
      recipient,
      content: caption,
      type: 'gif',
      mediaUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localMsg]);
    saveVault({ messages: [localMsg] });
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('67_gang_messages');
        bc.postMessage({ type: 'new_message', message: localMsg });
        bc.close();
      }
    } catch {}
    return true;
  };

  // Save Custom Media (Upload Handler from Crop Modal)
  const handleSaveCroppedMedia = async (payload: {
    name: string;
    type: 'emoji' | 'gif';
    dataUrl: string;
    shape: CropShape | 'original';
  }) => {
    if (!token) return;

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save media');
    }

    const data = await res.json();
    setCustomMedia((prev) => {
      if (prev.some((m) => m.id === data.media.id)) return prev;
      return [data.media, ...prev];
    });
  };

  // Toggle Reaction on a message
  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUser) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const currentReactions: Record<string, string[]> = { ...(m.reactions || {}) };
          const list = currentReactions[emoji] || [];
          if (list.includes(currentUser.username)) {
            const nextList = list.filter((u) => u !== currentUser.username);
            if (nextList.length === 0) {
              delete currentReactions[emoji];
            } else {
              currentReactions[emoji] = nextList;
            }
          } else {
            currentReactions[emoji] = [...list, currentUser.username];
          }
          return { ...m, reactions: currentReactions };
        })
      );

      // Send via WS
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'toggle_reaction',
            messageId,
            emoji,
          })
        );
      } else if (token) {
        // Fallback REST
        try {
          await fetch(`/api/messages/${messageId}/react`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ emoji }),
          });
        } catch (err) {
          console.error('Failed to toggle reaction via REST:', err);
        }
      }
    },
    [currentUser, token]
  );

  // Delete message (sender only)
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic delete
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      // Send via WS
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'delete_message',
            messageId,
          })
        );
      } else if (token) {
        // Fallback REST
        try {
          await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (err) {
          console.error('Failed to delete message via REST:', err);
        }
      }
    },
    [token]
  );

  // Save Cropped Avatar
  const handleSaveCroppedAvatar = async (croppedDataUrl: string) => {
    if (!token || !currentUser) return;
    setIsSavingAvatar(true);
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: croppedDataUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedAvatar = data.avatar || croppedDataUrl;
        const updatedUser: User = { ...currentUser, avatar: updatedAvatar };
        setCurrentUser(updatedUser);
        setUserAvatars((prev) => ({
          ...prev,
          [currentUser.username.toLowerCase()]: updatedAvatar,
        }));
        saveVault({ currentUser: updatedUser });

        // Broadcast via WS
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'update_avatar',
              avatar: updatedAvatar,
            })
          );
        }

        setCropperState({ isOpen: false, imageSrc: null });
        setIsAvatarSettingsOpen(false);
        setToast({
          id: String(Date.now()),
          type: 'success',
          message: 'Profile picture updated successfully!',
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({
          id: String(Date.now()),
          type: 'error',
          message: errData.error || 'Failed to update profile picture.',
        });
      }
    } catch (err) {
      console.error('Error saving avatar:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: 'Network error saving profile picture.',
      });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Reset Avatar to Default
  const handleResetAvatar = async () => {
    if (!token || !currentUser) return;
    setIsResettingAvatar(true);
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const updatedUser: User = { ...currentUser, avatar: null };
        setCurrentUser(updatedUser);
        setUserAvatars((prev) => {
          const next = { ...prev };
          delete next[currentUser.username.toLowerCase()];
          return next;
        });
        saveVault({ currentUser: updatedUser });

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'update_avatar',
              avatar: null,
            })
          );
        }

        setToast({
          id: String(Date.now()),
          type: 'info',
          message: 'Profile picture reset to default avatar.',
        });
      }
    } catch (err) {
      console.error('Error resetting avatar:', err);
    } finally {
      setIsResettingAvatar(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#0b0e17] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs font-medium text-zinc-300">Loading 67 Gang Chat...</p>
      </div>
    );
  }

  // If not logged in, show Auth Screen
  if (!currentUser || !token) {
    return (
      <AuthScreen
        status={authStatus}
        onLoginSuccess={handleLoginSuccess}
        onRefreshStatus={fetchAuthStatus}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0e17] text-zinc-100 font-sans">
      {/* Discord-style Left Sidebar for 67 Gang & Private DMs */}
      <DiscordSidebar
        currentUser={currentUser}
        classmates={authStatus.registeredNames}
        activeChannel={activeChannel}
        onSelectChannel={(ch) => {
          setActiveChannel(ch);
          updateLastRead(ch);
        }}
        unreadCounts={unreadCounts}
        onlineUsernames={onlineUsers}
        userAvatars={userAvatars}
        onOpenAvatarSettings={() => setIsAvatarSettingsOpen(true)}
      />

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header
          currentUser={currentUser}
          isConnected={isConnected}
          onlineCount={onlineUsers.length || 1}
          activeChannel={activeChannel}
          onLogout={handleLogout}
          onOpenOnlineDrawer={() => setIsOnlineDrawerOpen(true)}
          onSelectMainChat={() => {
            setActiveChannel('main');
            updateLastRead('main');
          }}
          onOpenAvatarSettings={() => setIsAvatarSettingsOpen(true)}
          userAvatars={userAvatars}
          typingUsers={currentTypingUsers}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <ChatArea
            messages={currentChannelMessages}
            currentUser={currentUser}
            customEmojis={customEmojis}
            isLoadingMessages={isLoadingMessages}
            firstUnreadMessageId={firstUnreadId}
            activeChatTitle={activeChannel === 'main' ? '67 Gang Chat' : activeChannel}
            isDm={activeChannel !== 'main'}
            onToggleReaction={handleToggleReaction}
            onDeleteMessage={handleDeleteMessage}
            userAvatars={userAvatars}
          />
          <MessageInput
            onSendMessage={handleSendMessage}
            onSendGif={handleSendGif}
            customEmojis={customEmojis}
            customGifs={customGifs}
            onTyping={handleSendTyping}
            onOpenUploadModal={(file, type) => {
              setCropModalState({
                isOpen: true,
                file,
                mediaType: type,
              });
            }}
            disabled={!currentUser}
          />
        </main>
      </div>

      {/* Online Classmates Drawer */}
      <OnlineMembersDrawer
        isOpen={isOnlineDrawerOpen}
        onClose={() => setIsOnlineDrawerOpen(false)}
        currentUser={currentUser}
        onlineUsernames={onlineUsers}
        registeredUsernames={authStatus.registeredNames}
        userAvatars={userAvatars}
      />

      {/* Upload & Crop Modal Popup in the Middle */}
      <CropMediaModal
        isOpen={cropModalState.isOpen}
        onClose={() => setCropModalState({ isOpen: false, file: null, mediaType: 'emoji' })}
        file={cropModalState.file}
        mediaType={cropModalState.mediaType}
        onSave={handleSaveCroppedMedia}
      />

      {/* Avatar Management & Options Modal */}
      <AvatarSettingsModal
        isOpen={isAvatarSettingsOpen}
        onClose={() => setIsAvatarSettingsOpen(false)}
        currentUser={currentUser}
        onOpenCropper={(src) => {
          setIsAvatarSettingsOpen(false);
          setCropperState({ isOpen: true, imageSrc: src });
        }}
        onOpenCamera={() => {
          setIsAvatarSettingsOpen(false);
          setIsCameraOpen(true);
        }}
        onResetAvatar={handleResetAvatar}
        isResetting={isResettingAvatar}
      />

      {/* Live Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(capturedDataUrl) => {
          setIsCameraOpen(false);
          setCropperState({ isOpen: true, imageSrc: capturedDataUrl });
        }}
      />

      {/* Interactive Circle Cropper Modal */}
      <AvatarCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.imageSrc}
        onClose={() => setCropperState({ isOpen: false, imageSrc: null })}
        onSave={handleSaveCroppedAvatar}
        isSaving={isSavingAvatar}
      />

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
