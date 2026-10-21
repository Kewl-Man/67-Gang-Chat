import React from 'react';
import { LogOut, Users, Wifi, WifiOff, MessageSquare, Camera } from 'lucide-react';
import type { User } from '../types/chat.ts';
import { UserAvatar } from './UserAvatar.tsx';

interface HeaderProps {
  currentUser: User;
  isConnected: boolean;
  onlineCount: number;
  activeChannel: 'main' | string;
  onLogout: () => void;
  onOpenOnlineDrawer: () => void;
  onSelectMainChat: () => void;
  onOpenAvatarSettings: () => void;
  userAvatars?: Record<string, string>;
  typingUsers?: string[];
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isConnected,
  onlineCount,
  activeChannel,
  onLogout,
  onOpenOnlineDrawer,
  onSelectMainChat,
  onOpenAvatarSettings,
  userAvatars = {},
  typingUsers = [],
}) => {
  const isMain = activeChannel === 'main';
  const dmAvatar = !isMain ? userAvatars[activeChannel.toLowerCase()] : undefined;

  const formatTypingText = (users: string[]) => {
    if (users.length === 1) {
      return `${users[0]} is typing...`;
    }
    if (users.length === 2) {
      return `${users[0]} and ${users[1]} are typing...`;
    }
    return `${users[0]}, ${users[1]} and ${users.length - 2} others are typing...`;
  };

  return (
    <header className="h-16 border-b border-[#1f2638] bg-[#101422]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between select-none sticky top-0 z-30">
      {/* Brand & Channel Info */}
      <div className="flex items-center gap-3 min-w-0">
        {isMain ? (
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 font-black text-white text-base shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 shrink-0">
            67
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#101422] flex items-center justify-center">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
            </span>
          </div>
        ) : (
          <div className="relative shrink-0">
            <UserAvatar
              username={activeChannel}
              avatarUrl={dmAvatar}
              size="md"
              className="rounded-xl shadow-md ring-1 ring-white/10"
            />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-white text-base sm:text-lg tracking-tight flex items-center gap-1.5 truncate">
              {!isMain && <span className="text-indigo-400 font-mono">@</span>}
              <span className="truncate">{isMain ? '67 Gang Chat' : activeChannel}</span>
            </h1>
            {!isMain && (
              <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                Direct Message
              </span>
            )}

            {/* Desktop Typing Badge */}
            {typingUsers.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-medium shadow-xs animate-fadeIn">
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                </span>
                <span className="italic">{formatTypingText(typingUsers)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            {isConnected ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium shrink-0">
                <Wifi className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 font-medium shrink-0">
                <WifiOff className="w-3 h-3" />
                <span>Reconnecting...</span>
              </span>
            )}

            {isMain ? (
              <>
                <span className="text-zinc-500">•</span>
                <button
                  type="button"
                  onClick={onOpenOnlineDrawer}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                >
                  <Users className="w-3 h-3" />
                  <span>{onlineCount} {onlineCount === 1 ? 'member' : 'members'} online</span>
                </button>
              </>
            ) : (
              <>
                <span className="text-zinc-500">•</span>
                <button
                  type="button"
                  onClick={onSelectMainChat}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Back to 67 Gang</span>
                </button>
              </>
            )}

            {/* Mobile / Inline Typing Indicator */}
            {typingUsers.length > 0 && (
              <>
                <span className="text-zinc-600 sm:hidden">•</span>
                <span className="sm:hidden inline-flex items-center gap-1 text-indigo-400 font-medium italic animate-fadeIn truncate max-w-[200px]">
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" />
                  </span>
                  <span className="truncate">{formatTypingText(typingUsers)}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Profile Badge (Clickable to customize avatar) */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3">
          <div
            onClick={onOpenAvatarSettings}
            role="button"
            tabIndex={0}
            title="Click to customize profile picture / avatar"
            className="group relative cursor-pointer flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#1a2133] transition-all"
          >
            <div className="relative">
              <UserAvatar
                username={currentUser.username}
                avatarUrl={currentUser.avatar}
                size="sm"
                className="ring-2 ring-transparent group-hover:ring-indigo-400 transition-all shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-xs">
                <Camera className="w-2.5 h-2.5" />
              </span>
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-zinc-200 leading-tight group-hover:text-indigo-300 transition-colors">
                {currentUser.username}
              </span>
              <span className="text-[10px] text-zinc-400">
                {currentUser.avatar ? 'Custom Photo' : 'Default Avatar'}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log Out"
            className="p-2 ml-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
