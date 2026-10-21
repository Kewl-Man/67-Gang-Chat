import React from 'react';
import { X, Users, CheckCircle, Clock } from 'lucide-react';
import { APPROVED_NAMES } from '../config/whitelist.ts';
import { getInitials, getMemberPalette } from '../utils/avatar.ts';
import type { User } from '../types/chat.ts';

interface OnlineMembersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onlineUsernames: string[];
  registeredUsernames: string[];
}

export const OnlineMembersDrawer: React.FC<OnlineMembersDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onlineUsernames,
  registeredUsernames,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-sm bg-[#131724] border-l border-[#242c3f] h-full flex flex-col z-10 shadow-2xl animate-slideLeft">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22283a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">67 Gang Classmates</h2>
              <p className="text-[11px] text-zinc-400">
                {onlineUsernames.length} online • {registeredUsernames.length}/{APPROVED_NAMES.length} registered
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1f2538] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Roster List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {APPROVED_NAMES.map((name) => {
            const isMe = name.toLowerCase() === currentUser.username.toLowerCase();
            const isOnline = onlineUsernames.some(
              (u) => u.toLowerCase() === name.toLowerCase()
            );
            const isRegistered = registeredUsernames.some(
              (u) => u.toLowerCase() === name.toLowerCase()
            );
            const palette = getMemberPalette(name);
            const initials = getInitials(name);

            return (
              <div
                key={name}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'bg-indigo-950/20 border-indigo-700/40 shadow-xs'
                    : isOnline
                    ? 'bg-[#181d2c] border-[#293247]'
                    : 'bg-[#131722] border-[#1d2334] opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-tr ${palette.bg} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/10`}
                    >
                      {initials}
                    </div>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#131724] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-zinc-100">{name}</span>
                      {isMe && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      {isOnline ? (
                        <span className="text-emerald-400 font-medium">Active in chat</span>
                      ) : isRegistered ? (
                        <span className="text-zinc-400">Offline</span>
                      ) : (
                        <span className="text-amber-400/80">Account not created yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Online
                    </span>
                  ) : isRegistered ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                      <CheckCircle className="w-2.5 h-2.5 text-zinc-400" />
                      Joined
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      <Clock className="w-2.5 h-2.5" />
                      Waiting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-[#22283a] bg-[#0e111a] text-xs text-zinc-500">
          <p>
            Roster is fixed to our Sabaq group members. Edit{' '}
            <code className="text-indigo-300">src/config/whitelist.ts</code> to update names.
          </p>
        </div>
      </div>
    </div>
  );
};
