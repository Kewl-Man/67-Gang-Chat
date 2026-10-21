import type { ChatMessage, CustomMedia, User } from '../types/chat.ts';

const VAULT_KEY = '67_gang_vault_v2';
const LEGACY_VAULT_KEY = '67_gang_vault_v1';

export interface SavedAccountInfo {
  id: string;
  username: string;
  salt?: string;
  hash?: string;
  token?: string;
  createdAt?: string;
}

export interface LocalVaultData {
  currentUser: User | null;
  token: string | null;
  accountSalt?: string;
  accountHash?: string;
  savedAccounts: Record<string, SavedAccountInfo>;
  registeredNames: string[];
  messages: ChatMessage[];
  customMedia: CustomMedia[];
  lastSavedAt: string;
}

export function loadVault(): LocalVaultData {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        currentUser: data.currentUser || null,
        token: data.token || null,
        accountSalt: data.accountSalt,
        accountHash: data.accountHash,
        savedAccounts: data.savedAccounts || {},
        registeredNames: Array.isArray(data.registeredNames) ? data.registeredNames : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        customMedia: Array.isArray(data.customMedia) ? data.customMedia : [],
        lastSavedAt: data.lastSavedAt || new Date().toISOString(),
      };
    }

    // Migrate from v1 vault if present
    const legacy = localStorage.getItem(LEGACY_VAULT_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      const savedAccounts: Record<string, SavedAccountInfo> = {};
      if (data.currentUser && data.currentUser.username) {
        savedAccounts[data.currentUser.username.toLowerCase()] = {
          id: data.currentUser.id,
          username: data.currentUser.username,
          salt: data.accountSalt,
          hash: data.accountHash,
          token: data.token,
          createdAt: data.currentUser.createdAt,
        };
      }

      return {
        currentUser: data.currentUser || null,
        token: data.token || null,
        accountSalt: data.accountSalt,
        accountHash: data.accountHash,
        savedAccounts,
        registeredNames: data.currentUser ? [data.currentUser.username] : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        customMedia: Array.isArray(data.customMedia) ? data.customMedia : [],
        lastSavedAt: data.lastSavedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Failed to load local vault:', err);
  }

  return {
    currentUser: null,
    token: null,
    savedAccounts: {},
    registeredNames: [],
    messages: [],
    customMedia: [],
    lastSavedAt: new Date().toISOString(),
  };
}

export function saveVault(data: Partial<LocalVaultData>): void {
  try {
    const current = loadVault();

    // Merge accounts
    const mergedAccounts = { ...current.savedAccounts, ...(data.savedAccounts || {}) };
    if (data.currentUser && data.currentUser.username) {
      mergedAccounts[data.currentUser.username.toLowerCase()] = {
        id: data.currentUser.id,
        username: data.currentUser.username,
        salt: data.accountSalt || current.accountSalt,
        hash: data.accountHash || current.accountHash,
        token: data.token || current.token || undefined,
        createdAt: data.currentUser.createdAt,
      };
    }

    // Merge registered names
    const namesSet = new Set<string>([
      ...current.registeredNames,
      ...(data.registeredNames || []),
      ...Object.values(mergedAccounts).map((a) => a.username),
    ]);

    // Merge messages by ID
    const msgMap = new Map<string, ChatMessage>();
    for (const m of current.messages) if (m && m.id) msgMap.set(m.id, m);
    if (data.messages) {
      for (const m of data.messages) if (m && m.id) msgMap.set(m.id, m);
    }
    const mergedMessages = Array.from(msgMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Merge custom media by ID
    const mediaMap = new Map<string, CustomMedia>();
    for (const m of current.customMedia) if (m && m.id) mediaMap.set(m.id, m);
    if (data.customMedia) {
      for (const m of data.customMedia) if (m && m.id) mediaMap.set(m.id, m);
    }
    const mergedMedia = Array.from(mediaMap.values());

    const updated: LocalVaultData = {
      ...current,
      ...data,
      savedAccounts: mergedAccounts,
      registeredNames: Array.from(namesSet),
      messages: mergedMessages,
      customMedia: mergedMedia,
      lastSavedAt: new Date().toISOString(),
    };

    localStorage.setItem(VAULT_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save to local vault:', err);
  }
}

/**
 * Auto-heals and synchronizes local vault data with server so that no accounts,
 * credentials, messages, or custom media are ever lost even if the container or server restarted.
 */
export async function syncVaultWithServer(vault: LocalVaultData): Promise<boolean> {
  const accountsToSync = Object.values(vault.savedAccounts);

  // If there's nothing to sync, return true
  if (accountsToSync.length === 0 && (!vault.messages || vault.messages.length === 0) && (!vault.customMedia || vault.customMedia.length === 0)) {
    return true;
  }

  try {
    const res = await fetch('/api/sync/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accounts: accountsToSync,
        user: vault.currentUser,
        token: vault.token,
        accountSalt: vault.accountSalt,
        accountHash: vault.accountHash,
        registeredNames: vault.registeredNames,
        messages: vault.messages,
        customMedia: vault.customMedia,
      }),
    });

    if (res.ok) {
      console.log('[67 Gang Vault] Bulletproof sync complete with server!');
      return true;
    }
  } catch (err) {
    console.warn('[67 Gang Vault] Auto-heal sync note:', err);
  }
  return false;
}
