import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { APPROVED_NAMES } from './src/config/whitelist.ts';
import type { ChatMessage, CustomMedia, User } from './src/types/chat.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DB_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DB_DIR, 'uploads');
const DB_FILE = path.resolve(DB_DIR, 'chat_db.json');
const BACKUP_FILE = path.resolve(DB_DIR, 'chat_db_backup.json');
const PERSISTENT_FILE = path.resolve(DB_DIR, 'chat_db_persistent.json');

// Database schema
interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  username: string;
  createdAt: string;
}

interface DatabaseData {
  users: StoredUser[];
  sessions: StoredSession[];
  messages: ChatMessage[];
  customMedia: CustomMedia[];
}

export function getDmChannelId(userA: string, userB: string): string {
  const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

// Initialize database by merging all persistent files so no data is ever lost
function initDatabase(): DatabaseData {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const loadFromFile = (filePath: string): DatabaseData | null => {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as DatabaseData;
        const userCustomMedia = Array.isArray(data.customMedia)
          ? data.customMedia.filter((m) => !m.id.startsWith('seed_'))
          : [];

        return {
          users: Array.isArray(data.users) ? data.users : [],
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          messages: Array.isArray(data.messages) ? data.messages : [],
          customMedia: userCustomMedia,
        };
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
      }
    }
    return null;
  };

  const files = [DB_FILE, BACKUP_FILE, PERSISTENT_FILE];
  const mergedUsersMap = new Map<string, StoredUser>();
  const mergedSessionsMap = new Map<string, StoredSession>();
  const mergedMessagesMap = new Map<string, ChatMessage>();
  const mergedMediaMap = new Map<string, CustomMedia>();

  for (const file of files) {
    const loaded = loadFromFile(file);
    if (loaded) {
      for (const u of loaded.users) {
        if (u && u.username) {
          const key = u.username.toLowerCase();
          const existing = mergedUsersMap.get(key);
          if (!existing || (!existing.passwordHash && u.passwordHash)) {
            mergedUsersMap.set(key, u);
          }
        }
      }
      for (const s of loaded.sessions) {
        if (s && s.token) mergedSessionsMap.set(s.token, s);
      }
      for (const m of loaded.messages) {
        if (m && m.id) mergedMessagesMap.set(m.id, m);
      }
      for (const cm of loaded.customMedia) {
        if (cm && cm.id) mergedMediaMap.set(cm.id, cm);
      }
    }
  }

  const sortedMessages = Array.from(mergedMessagesMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const mergedData: DatabaseData = {
    users: Array.from(mergedUsersMap.values()),
    sessions: Array.from(mergedSessionsMap.values()),
    messages: sortedMessages,
    customMedia: Array.from(mergedMediaMap.values()),
  };

  try {
    const payload = JSON.stringify(mergedData, null, 2);
    fs.writeFileSync(DB_FILE, payload, 'utf-8');
    fs.writeFileSync(BACKUP_FILE, payload, 'utf-8');
    fs.writeFileSync(PERSISTENT_FILE, payload, 'utf-8');
  } catch (err) {
    console.error('Failed to write initial db backups:', err);
  }

  return mergedData;
}

const db: DatabaseData = initDatabase();

function persistDatabase(): void {
  try {
    const payload = JSON.stringify(db, null, 2);
    const targets = [DB_FILE, BACKUP_FILE, PERSISTENT_FILE];
    for (const target of targets) {
      try {
        const tmp = `${target}.tmp`;
        fs.writeFileSync(tmp, payload, 'utf-8');
        fs.renameSync(tmp, target);
      } catch (err) {
        // Fallback direct write
        fs.writeFileSync(target, payload, 'utf-8');
      }
    }
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

// Password hashing utilities using crypto
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const computedHash = hashPassword(password, salt);
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

function getSessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  const user = getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '40mb' }));
  app.use(express.urlencoded({ extended: true, limit: '40mb' }));

  // Static serving for uploaded custom GIFs and emojis
  app.use('/uploads', express.static(UPLOADS_DIR));

  // WebSocket Server Setup
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Map of connected sockets to authenticated usernames
  const clientSockets = new Map<WebSocket, { user: User; token: string }>();

  function getOnlineUsernames(): string[] {
    const unique = new Set<string>();
    for (const client of clientSockets.values()) {
      unique.add(client.user.username);
    }
    return Array.from(unique);
  }

  function broadcast(data: object): void {
    const messageStr = JSON.stringify(data);
    for (const [socket] of clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      }
    }
  }

  function broadcastPresence(): void {
    const online = getOnlineUsernames();
    broadcast({ type: 'presence', onlineUsers: online });
  }

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    let initialUser: User | null = null;
    let initialToken = '';

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (token) {
        initialUser = getSessionUser(token);
        if (initialUser) {
          initialToken = token;
          clientSockets.set(ws, { user: initialUser, token });
        }
      }
    } catch (err) {
      console.error('WS URL parse error:', err);
    }

    if (initialUser) {
      const myUsername = initialUser.username.toLowerCase();
      const visibleMessages = db.messages.filter((m) => {
        if (!m.channelId || m.channelId === 'main') return true;
        return (
          m.sender.toLowerCase() === myUsername ||
          (m.recipient && m.recipient.toLowerCase() === myUsername) ||
          m.channelId.includes(myUsername)
        );
      });

      ws.send(
        JSON.stringify({
          type: 'init',
          messages: visibleMessages,
          onlineUsers: getOnlineUsernames(),
          customMedia: db.customMedia,
        })
      );
      broadcastPresence();
    }

    ws.on('message', (rawData) => {
      try {
        const payload = JSON.parse(rawData.toString());

        if (payload.type === 'auth') {
          const user = getSessionUser(payload.token);
          if (user) {
            clientSockets.set(ws, { user, token: payload.token });
            const myUsername = user.username.toLowerCase();
            const visibleMessages = db.messages.filter((m) => {
              if (!m.channelId || m.channelId === 'main') return true;
              return (
                m.sender.toLowerCase() === myUsername ||
                (m.recipient && m.recipient.toLowerCase() === myUsername) ||
                m.channelId.includes(myUsername)
              );
            });

            ws.send(
              JSON.stringify({
                type: 'init',
                messages: visibleMessages,
                onlineUsers: getOnlineUsernames(),
                customMedia: db.customMedia,
              })
            );
            broadcastPresence();
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed.' }));
          }
          return;
        }

        if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (payload.type === 'send_message') {
          const client = clientSockets.get(ws);
          if (!client) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized. Please authenticate.' }));
            return;
          }

          const msgType = payload.msgType === 'gif' ? 'gif' : 'text';
          const mediaUrl = typeof payload.mediaUrl === 'string' ? payload.mediaUrl : undefined;
          const content = typeof payload.content === 'string' ? payload.content.trim() : (mediaUrl ? 'GIF' : '');

          if (!content && !mediaUrl) {
            ws.send(JSON.stringify({ type: 'error', message: 'Message content cannot be empty.' }));
            return;
          }
          if (content.length > 1000) {
            ws.send(JSON.stringify({ type: 'error', message: 'Message cannot exceed 1000 characters.' }));
            return;
          }

          let channelId = payload.channelId || 'main';
          let recipient = payload.recipient;

          if (recipient) {
            channelId = getDmChannelId(client.user.username, recipient);
          }

          const newMsg: ChatMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            channelId,
            userId: client.user.id,
            sender: client.user.username,
            recipient,
            content,
            type: msgType,
            mediaUrl,
            createdAt: new Date().toISOString(),
          };

          db.messages.push(newMsg);
          persistDatabase();

          broadcast({
            type: 'new_message',
            message: newMsg,
          });
          return;
        }

        if (payload.type === 'toggle_reaction') {
          const client = clientSockets.get(ws);
          if (!client) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized.' }));
            return;
          }

          const { messageId, emoji } = payload;
          if (!messageId || !emoji || typeof emoji !== 'string') return;
          const msg = db.messages.find((m) => m.id === messageId);
          if (!msg) return;

          if (!msg.reactions) msg.reactions = {};
          const existing = msg.reactions[emoji] || [];
          const username = client.user.username;

          if (existing.includes(username)) {
            msg.reactions[emoji] = existing.filter((u) => u !== username);
            if (msg.reactions[emoji].length === 0) {
              delete msg.reactions[emoji];
            }
          } else {
            msg.reactions[emoji] = [...existing, username];
          }

          persistDatabase();
          broadcast({
            type: 'message_reaction',
            messageId: msg.id,
            reactions: msg.reactions,
          });
          return;
        }

        if (payload.type === 'delete_message') {
          const client = clientSockets.get(ws);
          if (!client) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized.' }));
            return;
          }

          const { messageId } = payload;
          if (!messageId) return;
          const msg = db.messages.find((m) => m.id === messageId);
          if (!msg) return;

          // Strictly allow users to only delete their own message
          if (
            msg.sender.toLowerCase() !== client.user.username.toLowerCase() &&
            msg.userId !== client.user.id
          ) {
            ws.send(JSON.stringify({ type: 'error', message: 'You can only delete your own messages.' }));
            return;
          }

          db.messages = db.messages.filter((m) => m.id !== messageId);
          persistDatabase();

          broadcast({
            type: 'message_deleted',
            messageId,
            channelId: msg.channelId,
          });
          return;
        }
      } catch (err) {
        console.error('WS message handling error:', err);
      }
    });

    ws.on('close', () => {
      clientSockets.delete(ws);
      broadcastPresence();
    });

    ws.on('error', () => {
      clientSockets.delete(ws);
      broadcastPresence();
    });
  });

  // REST API Routes

  // 1. Get whitelist and registration status
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const registeredNames = db.users.map((u) => u.username);
    const availableNames = APPROVED_NAMES.filter((name) => !registeredNames.includes(name));

    res.json({
      approvedNames: APPROVED_NAMES,
      registeredNames,
      availableNames,
    });
  });

  // 2. Register account
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, password, confirmPassword } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Please select an approved username.' });
    }

    const trimmedName = username.trim();

    if (!APPROVED_NAMES.includes(trimmedName)) {
      return res.status(403).json({
        error: 'That name is not on the approved 67 Gang list. Please choose your name from the dropdown.',
      });
    }

    const existing = db.users.find((u) => u.username.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return res.status(409).json({
        error: `The account for "${trimmedName}" has already been created. Please log in instead.`,
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match. Please re-enter carefully.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser: StoredUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      username: trimmedName,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    const token = generateToken();
    db.sessions.push({
      token,
      userId: newUser.id,
      username: newUser.username,
      createdAt: new Date().toISOString(),
    });

    persistDatabase();

    const registeredNames = db.users.map((u) => u.username);
    const availableNames = APPROVED_NAMES.filter((name) => !registeredNames.includes(name));

    broadcast({
      type: 'user_registered',
      username: trimmedName,
      availableNames,
      registeredNames,
    });

    res.status(201).json({
      token,
      accountSalt: newUser.salt,
      accountHash: newUser.passwordHash,
      user: {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt,
      },
    });
  });

  // 3. Log in
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Please select your username.' });
    }

    const trimmedName = username.trim();
    const user = db.users.find((u) => u.username.toLowerCase() === trimmedName.toLowerCase());

    if (!user) {
      return res.status(404).json({
        error: `No account exists yet for "${trimmedName}". Please switch to "Create Account" first.`,
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const isMatch = verifyPassword(password, user.salt, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = generateToken();
    db.sessions.push({
      token,
      userId: user.id,
      username: user.username,
      createdAt: new Date().toISOString(),
    });

    persistDatabase();

    res.json({
      token,
      accountSalt: user.salt,
      accountHash: user.passwordHash,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  });

  // 4. Reset Password (allows classmates to reset their password if lost or misconfigured)
  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const { username, newPassword, confirmPassword } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Please select your username.' });
    }

    const trimmedName = username.trim();
    let user = db.users.find((u) => u.username.toLowerCase() === trimmedName.toLowerCase());

    if (!user) {
      // If user doesn't exist yet on server, check if name is approved and create it directly
      if (!APPROVED_NAMES.includes(trimmedName)) {
        return res.status(403).json({ error: 'That name is not on the approved 67 Gang list.' });
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(newPassword || '', salt);
      user = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        username: trimmedName,
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match. Please re-enter carefully.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(newPassword, salt);

    user.passwordHash = passwordHash;
    user.salt = salt;

    const token = generateToken();
    db.sessions.push({
      token,
      userId: user.id,
      username: user.username,
      createdAt: new Date().toISOString(),
    });

    persistDatabase();

    res.json({
      token,
      accountSalt: user.salt,
      accountHash: user.passwordHash,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
      message: 'Password reset successfully!',
    });
  });

  // 4. Current user / session verification
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // 5. Log out
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) {
      db.sessions = db.sessions.filter((s) => s.token !== token);
      persistDatabase();
    }
    res.json({ success: true });
  });

  // 6. Get message history
  app.get('/api/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const myUsername = req.user!.username.toLowerCase();
    const visibleMessages = db.messages.filter((m) => {
      if (!m.channelId || m.channelId === 'main') return true;
      return (
        m.sender.toLowerCase() === myUsername ||
        (m.recipient && m.recipient.toLowerCase() === myUsername) ||
        m.channelId.includes(myUsername)
      );
    });

    res.json({ messages: visibleMessages });
  });

  // 7. Send message via HTTP fallback
  app.post('/api/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { content, msgType, mediaUrl, channelId: reqChannelId, recipient } = req.body;
    const finalType = msgType === 'gif' ? 'gif' : 'text';
    const trimmed = typeof content === 'string' ? content.trim() : (mediaUrl ? 'GIF' : '');

    if (!trimmed && !mediaUrl) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'Message cannot exceed 1000 characters.' });
    }

    const user = req.user!;
    let channelId = reqChannelId || 'main';
    if (recipient) {
      channelId = getDmChannelId(user.username, recipient);
    }

    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      channelId,
      userId: user.id,
      sender: user.username,
      recipient,
      content: trimmed,
      type: finalType,
      mediaUrl: typeof mediaUrl === 'string' ? mediaUrl : undefined,
      createdAt: new Date().toISOString(),
    };

    db.messages.push(newMsg);
    persistDatabase();

    broadcast({
      type: 'new_message',
      message: newMsg,
    });

    res.status(201).json({ message: newMsg });
  });

  // 7b. Toggle reaction on a message
  app.post('/api/messages/:id/react', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required.' });
    }

    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (!msg.reactions) msg.reactions = {};
    const existing = msg.reactions[emoji] || [];
    const username = req.user!.username;

    if (existing.includes(username)) {
      msg.reactions[emoji] = existing.filter((u) => u !== username);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji] = [...existing, username];
    }

    persistDatabase();

    broadcast({
      type: 'message_reaction',
      messageId: msg.id,
      reactions: msg.reactions,
    });

    res.json({ success: true, reactions: msg.reactions });
  });

  // 7c. Delete message (sender only)
  app.delete('/api/messages/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const messageId = req.params.id;
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Only allow sender to delete their own message
    if (
      msg.sender.toLowerCase() !== req.user!.username.toLowerCase() &&
      msg.userId !== req.user!.id
    ) {
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    db.messages = db.messages.filter((m) => m.id !== messageId);
    persistDatabase();

    broadcast({
      type: 'message_deleted',
      messageId,
      channelId: msg.channelId,
    });

    res.json({ success: true, messageId });
  });

  // 8. Custom Media Endpoints
  app.get('/api/media', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const emojis = db.customMedia.filter((m) => m.type === 'emoji');
    const gifs = db.customMedia.filter((m) => m.type === 'gif');
    res.json({ emojis, gifs, all: db.customMedia });
  });

  app.post('/api/media/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { name, type, dataUrl, shape } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Media name is required.' });
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const mediaType = type === 'gif' ? 'gif' : 'emoji';

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Data URL is required.' });
    }

    const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    let publicUrl = dataUrl;

    if (dataUrl.startsWith('data:')) {
      try {
        const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          const base64Data = matches[2];
          const ext = mime.includes('gif') ? 'gif' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
          const fileName = `${cleanName}_${mediaId}.${ext}`;
          const filePath = path.resolve(UPLOADS_DIR, fileName);

          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          publicUrl = `/uploads/${fileName}`;
        }
      } catch (err) {
        console.error('Failed to write file to disk, using data URL fallback:', err);
      }
    }

    const newMedia: CustomMedia = {
      id: mediaId,
      name: cleanName,
      type: mediaType,
      url: publicUrl,
      shape: shape === 'circle' ? 'circle' : shape === 'rounded' ? 'rounded' : shape === 'original' ? 'original' : 'square',
      createdBy: req.user!.username,
      createdAt: new Date().toISOString(),
    };

    db.customMedia.push(newMedia);
    persistDatabase();

    broadcast({
      type: 'custom_media_added',
      media: newMedia,
    });

    res.status(201).json({ media: newMedia });
  });

  // 9. Client Vault Auto-Heal & Restore Endpoint (prevents data loss across restarts)
  app.post('/api/sync/restore', (req: Request, res: Response) => {
    const { accounts, user, token, accountSalt, accountHash, registeredNames, messages, customMedia } = req.body;

    let modified = false;

    // 1. Process multiple accounts from client vault
    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        if (!acc || !acc.username) continue;
        const cleanName = acc.username.trim();
        let existingUser = db.users.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());
        if (!existingUser) {
          existingUser = {
            id: acc.id || 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            username: cleanName,
            passwordHash: acc.hash || '',
            salt: acc.salt || '',
            createdAt: acc.createdAt || new Date().toISOString(),
          };
          db.users.push(existingUser);
          modified = true;
        } else {
          if (acc.hash && !existingUser.passwordHash) {
            existingUser.passwordHash = acc.hash;
            modified = true;
          }
          if (acc.salt && !existingUser.salt) {
            existingUser.salt = acc.salt;
            modified = true;
          }
        }

        if (acc.token) {
          const existingSession = db.sessions.find((s) => s.token === acc.token);
          if (!existingSession) {
            db.sessions.push({
              token: acc.token,
              userId: existingUser.id,
              username: existingUser.username,
              createdAt: new Date().toISOString(),
            });
            modified = true;
          }
        }
      }
    }

    // 2. Process primary user object if passed
    if (user && user.username) {
      const cleanName = user.username.trim();
      let existingUser = db.users.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());

      if (!existingUser) {
        existingUser = {
          id: user.id || 'usr_' + Date.now(),
          username: cleanName,
          passwordHash: accountHash || '',
          salt: accountSalt || '',
          createdAt: user.createdAt || new Date().toISOString(),
        };
        db.users.push(existingUser);
        modified = true;
      } else {
        if (accountHash && !existingUser.passwordHash) {
          existingUser.passwordHash = accountHash;
          modified = true;
        }
        if (accountSalt && !existingUser.salt) {
          existingUser.salt = accountSalt;
          modified = true;
        }
      }

      if (token) {
        const existingSession = db.sessions.find((s) => s.token === token);
        if (!existingSession) {
          db.sessions.push({
            token,
            userId: existingUser.id,
            username: existingUser.username,
            createdAt: new Date().toISOString(),
          });
          modified = true;
        }
      }
    }

    // 3. Process registered names list
    if (Array.isArray(registeredNames)) {
      for (const name of registeredNames) {
        if (typeof name !== 'string') continue;
        const cleanName = name.trim();
        const existing = db.users.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());
        if (!existing && APPROVED_NAMES.includes(cleanName)) {
          db.users.push({
            id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            username: cleanName,
            passwordHash: '',
            salt: '',
            createdAt: new Date().toISOString(),
          });
          modified = true;
        }
      }
    }

    // 4. Process messages
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg && msg.id && !db.messages.some((m) => m.id === msg.id)) {
          db.messages.push(msg);
          modified = true;
        }
      }
      if (modified) {
        db.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    }

    // 5. Process custom media
    if (Array.isArray(customMedia)) {
      for (const item of customMedia) {
        if (item && item.id && !db.customMedia.some((m) => m.id === item.id)) {
          db.customMedia.push(item);
          modified = true;
        }
      }
    }

    if (modified) {
      persistDatabase();
      const updatedRegistered = db.users.map((u) => u.username);
      const updatedAvailable = APPROVED_NAMES.filter((name) => !updatedRegistered.includes(name));
      broadcast({
        type: 'user_registered',
        availableNames: updatedAvailable,
        registeredNames: updatedRegistered,
      });
    }

    console.log(`[67 Gang Sync] Restored status: ${db.users.length} users, ${db.messages.length} messages, ${db.customMedia.length} media.`);
    res.json({
      success: true,
      users: db.users.length,
      messages: db.messages.length,
      customMedia: db.customMedia.length,
      registeredNames: db.users.map((u) => u.username),
    });
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[67 Gang Chat] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
