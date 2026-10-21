import React from 'react';
import { getInitials, getMemberPalette } from '../utils/avatar.ts';
import type { User } from '../types/chat.ts';

interface DiscordSidebarProps {
  currentUser: User;
  classmates: string[];
  activeChannel: 'main' | string; // 'main' for 67 Gang Chat, or username for DM
  onSelectChannel: (channel: 'main' | string) => void;
  unreadCounts: { [key: string]: number }; // key: 'main' or username
  onlineUsernames: string[];
}

// Deterministic stable shuffle so friends appear in the exact same order for everyone
function getDeterministicOrder(names: string[]): string[] {
  return [...names].sort((a, b) => {
    let hashA = 0;
    for (let i = 0; i < a.length; i++) hashA = (hashA * 37 + a.charCodeAt(i)) & 0x7fffffff;
    let hashB = 0;
    for (let i = 0; i < b.length; i++) hashB = (hashB * 37 + b.charCodeAt(i)) & 0x7fffffff;
    return hashA - hashB;
  });
}

export const DiscordSidebar: React.FC<DiscordSidebarProps> = ({
  currentUser,
  classmates,
  activeChannel,
  onSelectChannel,
  unreadCounts,
  onlineUsernames,
}) => {
  // Exclude current user from DM list, and order deterministically
  const otherClassmates = classmates.filter(
    (name) => name.toLowerCase() !== currentUser.username.toLowerCase()
  );
  const orderedFriends = getDeterministicOrder(otherClassmates);

  const isMainActive = activeChannel === 'main';
  const mainUnread = unreadCounts['main'] || 0;

  return (
    <nav
      aria-label="Channels and Direct Messages"
      className="w-18 bg-[#090c14] border-r border-[#1a2030] flex flex-col items-center py-3 select-none z-20 shrink-0 h-full overflow-y-auto scrollbar-none"
    >
      {/* 67 Gang Chat Main Server Icon (Like Discord logo at top) */}
      <div className="relative group flex items-center justify-center w-full my-1">
        {/* Left White Pill Active Indicator (Discord Style) */}
        <span
          className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
            isMainActive
              ? 'h-10'
              : mainUnread > 0
              ? 'h-2 group-hover:h-5'
              : 'h-0 group-hover:h-5'
          }`}
        />

        <button
          type="button"
          onClick={() => onSelectChannel('main')}
          title="67 Gang Chat (Main Circle)"
          className={`relative w-12 h-12 flex items-center justify-center text-white font-black text-lg transition-all duration-200 cursor-pointer shadow-md ${
            isMainActive
              ? 'rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 shadow-indigo-600/30'
              : 'rounded-[24px] hover:rounded-2xl bg-[#141824] hover:bg-gradient-to-tr hover:from-violet-600 hover:to-indigo-600'
          }`}
        >
          67
          {/* Unread badge for main chat */}
          {mainUnread > 0 && (
            <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white rounded-full font-bold text-[11px] flex items-center justify-center border-2 border-[#090c14] shadow-md animate-pulse">
              {mainUnread > 99 ? '99+' : mainUnread}
            </span>
          )}
        </button>
      </div>

      {/* Divider Line (Only shown when other registered classmate accounts exist) */}
      {orderedFriends.length > 0 && (
        <div className="w-8 h-[2px] bg-[#1e2538] rounded-full my-2.5" />
      )}

      {/* Direct Messages List (Only registered classmates who have created accounts) */}
      {orderedFriends.length > 0 && (
        <div className="flex-1 w-full flex flex-col items-center space-y-2.5">
          {orderedFriends.map((friendName) => {
            const isActive = activeChannel === friendName;
            const unread = unreadCounts[friendName] || 0;
            const isOnline = onlineUsernames.some(
              (u) => u.toLowerCase() === friendName.toLowerCase()
            );
            const palette = getMemberPalette(friendName);
            const initials = getInitials(friendName);

            return (
              <div key={friendName} className="relative group flex items-center justify-center w-full">
                {/* Discord Left White Indicator Bar */}
                <span
                  className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                    isActive
                      ? 'h-10'
                      : unread > 0
                      ? 'h-2.5 group-hover:h-5'
                      : 'h-0 group-hover:h-5'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => onSelectChannel(friendName)}
                  title={`DM ${friendName}`}
                  className={`relative w-12 h-12 flex items-center justify-center font-bold text-sm text-white shadow-sm transition-all duration-200 cursor-pointer ${
                    isActive
                      ? `rounded-2xl bg-gradient-to-tr ${palette.bg} ring-2 ring-indigo-500/50 shadow-md`
                      : `rounded-[24px] hover:rounded-2xl bg-gradient-to-tr ${palette.bg} hover:opacity-95 opacity-85`
                  }`}
                >
                  {initials}

                  {/* Online Indicator Dot */}
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#090c14] flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </span>
                  )}

                  {/* Discord-style Red Unread Notification Badge */}
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white rounded-full font-bold text-[11px] flex items-center justify-center border-2 border-[#090c14] shadow-lg animate-bounce">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
};
