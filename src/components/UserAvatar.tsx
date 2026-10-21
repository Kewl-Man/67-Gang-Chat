import React, { useState } from 'react';
import { getInitials, getMemberPalette } from '../utils/avatar.ts';

export interface UserAvatarProps {
  username?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  showStatusIndicator?: boolean; // Shows "Custom" vs "Default" indicator badge
  onClick?: () => void;
  alt?: string;
  useInitialsFallback?: boolean; // If false, renders the default SVG silhouette
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
  '3xl': 'w-32 h-32 text-4xl',
};

// Default SVG Silhouette Placeholder with clean paths
export const DefaultSilhouette: React.FC<{ className?: string }> = ({ className = 'w-full h-full text-zinc-400' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2ZM4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21Z"
    />
  </svg>
);

export const UserAvatar: React.FC<UserAvatarProps> = ({
  username = '',
  avatarUrl,
  size = 'md',
  className = '',
  showOnlineStatus = false,
  isOnline = false,
  showStatusIndicator = false,
  onClick,
  alt,
  useInitialsFallback = true,
}) => {
  const [hasImageError, setHasImageError] = useState(false);
  const palette = getMemberPalette(username || 'user');
  const initials = getInitials(username || '?');

  const hasCustomPicture = Boolean(avatarUrl && !hasImageError);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full select-none ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500' : ''
      } ${className}`}
    >
      {/* Circle Container */}
      <div
        className={`relative rounded-full overflow-hidden flex items-center justify-center ring-1 ring-white/10 shadow-sm ${sizeClass}`}
      >
        {hasCustomPicture ? (
          <img
            src={avatarUrl!}
            alt={alt || `${username}'s profile`}
            onError={() => setHasImageError(true)}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
          />
        ) : useInitialsFallback && username ? (
          <div
            className={`w-full h-full bg-gradient-to-tr ${palette.bg} flex items-center justify-center font-bold text-white tracking-wider`}
          >
            {initials}
          </div>
        ) : (
          <div className="w-full h-full bg-[#181d2a] p-[18%] flex items-center justify-center">
            <DefaultSilhouette className="w-full h-full text-zinc-400/80" />
          </div>
        )}
      </div>

      {/* Online Status Indicator */}
      {showOnlineStatus && isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#0c0f18] p-0.5">
          <span className="block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-[#0c0f18] animate-pulse" />
        </span>
      )}

      {/* Custom vs Default Status Indicator Badge */}
      {showStatusIndicator && (
        <span
          title={hasCustomPicture ? 'Custom Profile Picture Active' : 'Default Silhouette / Initials'}
          className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-md flex items-center gap-1 ${
            hasCustomPicture
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 bg-zinc-900/90'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              hasCustomPicture ? 'bg-emerald-400' : 'bg-zinc-400'
            }`}
          />
          {hasCustomPicture ? 'Custom' : 'Default'}
        </span>
      )}
    </div>
  );
};
