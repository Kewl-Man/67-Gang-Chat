import React from 'react';
import { LogOut, Users, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import type { User } from '../types/chat.ts';
import { getInitials, getMemberPalette } from '../utils/avatar.ts';

interface HeaderProps {
  currentUser: User;
  isConnected: boolean;
  onlineCount: number;
  activeChannel: 'main' | string;
  onLogout: () => void;
  onOpenOnlineDrawer: () => void;
  onSelectMainChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isConnected,
  onlineCount,
  activeChannel,
  onLogout,
  onOpenOnlineDrawer,
  onSelectMainChat,
}) => {
  const isMain = activeChannel === 'main';
  const dmPalette = !isMain ? getMemberPalette(activeChannel) : null;
  const dmInitials = !isMain ? getInitials(activeChannel) : null;
  const userPalette = getMemberPalette(currentUser.username);
  const userInitials = getInitials(currentUser.username);

  return (
    <header className="h-16 border-b border-[#1f2638] bg-[#101422]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between select-none sticky top-0 z-30">
      {/* Brand & Channel Info */}
      <div className="flex items-center gap-3">
        {isMain ? (
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 font-black text-white text-base shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
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
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${dmPalette?.bg} font-bold text-white text-sm flex items-center justify-center shadow-md ring-1 ring-white/10`}
          >
            {dmInitials}
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-white text-base sm:text-lg tracking-tight flex items-center gap-1.5">
              {!isMain && <span className="text-indigo-400 font-mono">@</span>}
              <span>{isMain ? '67 Gang Chat' : activeChannel}</span>
            </h1>
            {!isMain && (
              <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Direct Message
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isConnected ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <Wifi className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 font-medium">
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
                  className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
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
                  className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Back to 67 Gang</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3">
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-tr ${userPalette.bg} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/10`}
          >
            {userInitials}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-zinc-200 leading-tight">
              {currentUser.username}
            </span>
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
