import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, MessageSquare, Copy, Check, Trash2, SmilePlus } from 'lucide-react';
import type { ChatMessage, CustomMedia, User } from '../types/chat.ts';
import { getInitials, getMemberPalette } from '../utils/avatar.ts';

interface ChatAreaProps {
  messages: ChatMessage[];
  currentUser: User;
  customEmojis?: CustomMedia[];
  isLoadingMessages: boolean;
  firstUnreadMessageId?: string | null;
  activeChatTitle?: string;
  isDm?: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

const POPULAR_REACTIONS = ['👍', '❤️', '🔥', '😂'];
const EXTENDED_REACTIONS = [
  '👍', '❤️', '🔥', '😂', '😮', '😢', '👏', '🎉', '💯', '🚀', 
  '6️⃣', '7️⃣', '👀', '💀', '🗿', '🤝', '✨', '👑', '🎯', '⚡️',
  '😎', '🤯', '🙏', '💪', '🥳'
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentUser,
  customEmojis = [],
  isLoadingMessages,
  firstUnreadMessageId,
  activeChatTitle,
  isDm = false,
  onToggleReaction,
  onDeleteMessage,
}) => {
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

    if (isNearBottom || messages.length <= 1) {
      scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.reaction-popover-container') && !target.closest('.reaction-trigger-btn')) {
        setReactionPickerMsgId(null);
      }
      if (!target.closest('.delete-confirm-container')) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDelete = (msgId: string) => {
    onDeleteMessage(msgId);
    setConfirmDeleteId(null);
    setReactionPickerMsgId(null);
  };

  const formatMessageTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return timeStr;

      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    } catch {
      return '';
    }
  };

  const formatFullDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'New Messages';
    }
  };

  const renderMessageContent = (text: string) => {
    const emojiMap = new Map(customEmojis.map((e) => [`:${e.name.toLowerCase()}:`, e]));
    const regex = /(:[a-zA-Z0-9_-]+:)/g;
    const parts = text.split(regex);

    const trimmed = text.trim();
    const singleMatch = emojiMap.get(trimmed.toLowerCase());
    if (singleMatch && parts.filter(Boolean).length === 1) {
      return (
        <div className="py-1">
          <img
            src={singleMatch.url}
            alt={singleMatch.name}
            title={`:${singleMatch.name}:`}
            className={`w-14 h-14 object-contain ${
              singleMatch.shape === 'circle' ? 'rounded-full' : singleMatch.shape === 'rounded' ? 'rounded-xl' : 'rounded-md'
            }`}
          />
        </div>
      );
    }

    return (
      <span className="whitespace-pre-wrap select-text leading-relaxed">
        {parts.map((part, index) => {
          const matched = emojiMap.get(part.toLowerCase());
          if (matched) {
            return (
              <img
                key={index}
                src={matched.url}
                alt={matched.name}
                title={`:${matched.name}:`}
                className={`inline-block w-6 h-6 object-contain align-middle mx-0.5 ${
                  matched.shape === 'circle' ? 'rounded-full' : matched.shape === 'rounded' ? 'rounded-md' : 'rounded-xs'
                }`}
              />
            );
          }
          return part;
        })}
      </span>
    );
  };

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-[#0c0f18]">
      {/* Messages Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3.5 scroll-smooth"
      >
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-zinc-200">
              {isDm ? `Direct Message with ${activeChatTitle}` : 'Welcome to 67 Gang Chat!'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mt-1">
              {isDm
                ? `This is the start of your private conversation with ${activeChatTitle}.`
                : 'Send a message, drop a custom emoji, or share a reaction GIF!'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender.toLowerCase() === currentUser.username.toLowerCase();
            const palette = getMemberPalette(msg.sender);
            const initials = getInitials(msg.sender);
            const isGif = msg.type === 'gif' || !!msg.mediaUrl;
            const isFirstUnread = msg.id === firstUnreadMessageId;

            const prevMsg = messages[index - 1];
            const isChained =
              !isFirstUnread &&
              prevMsg &&
              prevMsg.sender.toLowerCase() === msg.sender.toLowerCase() &&
              Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) <
                300000;

            const isPickerOpen = reactionPickerMsgId === msg.id;
            const isConfirmDeleteOpen = confirmDeleteId === msg.id;

            return (
              <React.Fragment key={msg.id}>
                {/* DISCORD-STYLE UNREAD RED DIVIDER */}
                {isFirstUnread && (
                  <div className="relative flex items-center my-4 select-none animate-fadeIn">
                    <div className="flex-grow border-t border-red-500/90" />
                    <span className="shrink-0 px-3 text-[11px] font-bold text-red-500 bg-[#0c0f18] tracking-wide">
                      {formatFullDate(msg.createdAt)}
                    </span>
                    <div className="flex-grow border-t border-red-500/90" />
                    <span className="shrink-0 ml-2 px-2 py-0.5 rounded-sm bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                      NEW
                    </span>
                  </div>
                )}

                <div
                  className={`group/msg relative flex items-end gap-2 sm:gap-2.5 ${
                    isMe ? 'justify-end' : 'justify-start'
                  } ${isChained ? 'mt-1' : 'mt-3.5'}`}
                >
                  {/* Other user's avatar */}
                  {!isMe && (
                    <div className="w-8 h-8 shrink-0">
                      {!isChained ? (
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${palette.bg} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/10`}
                          title={msg.sender}
                        >
                          {initials}
                        </div>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                  )}

                  {/* Bubble Container */}
                  <div
                    className={`flex flex-col max-w-[88%] sm:max-w-[75%] md:max-w-[65%] ${
                      isMe ? 'items-end' : 'items-start'
                    }`}
                  >
                    {!isMe && !isChained && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className={`text-xs font-bold ${palette.text}`}>
                          {msg.sender}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble or GIF Container with Hover Toolbar */}
                    <div className="relative group/bubble flex items-center">
                      {/* Floating Discord-Style Action Toolbar on Hover */}
                      <div
                        className={`absolute -top-4.5 z-20 hidden group-hover/msg:flex items-center gap-0.5 px-1.5 py-1 bg-[#141824] border border-[#262f44] rounded-lg shadow-xl backdrop-blur-md transition-all ${
                          isMe ? 'right-0' : 'left-0'
                        }`}
                      >
                        {/* Quick Reaction Emojis */}
                        {POPULAR_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onToggleReaction(msg.id, emoji)}
                            className="p-1 hover:bg-[#202738] rounded text-xs transition-transform hover:scale-125 cursor-pointer leading-none"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}

                        {/* More Reactions Plus Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReactionPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                          }}
                          title="Add Reaction"
                          className="reaction-trigger-btn p-1 text-zinc-400 hover:text-indigo-400 hover:bg-[#202738] rounded transition-colors cursor-pointer"
                        >
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-[1px] h-3.5 bg-[#252c3f] mx-0.5" />

                        {/* Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.mediaUrl || msg.content)}
                          title="Copy text / link"
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#202738] rounded transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* RED TRASH CAN ICON - SENDER ONLY */}
                        {isMe && (
                          <>
                            <div className="w-[1px] h-3.5 bg-[#252c3f] mx-0.5" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId((prev) => (prev === msg.id ? null : msg.id));
                              }}
                              title="Delete your message"
                              className="p-1 text-red-400 hover:text-white hover:bg-red-600/30 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Extended Reaction Picker Popover */}
                      {isPickerOpen && (
                        <div
                          className={`reaction-popover-container absolute z-30 bottom-full mb-2 p-2 bg-[#121622] border border-[#2b354b] rounded-xl shadow-2xl backdrop-blur-lg w-64 animate-fadeIn ${
                            isMe ? 'right-0' : 'left-0'
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold text-zinc-400 px-1 mb-1.5 flex items-center justify-between">
                            <span>Add Reaction</span>
                            <span className="text-[9px] text-zinc-500 font-normal">Click to react</span>
                          </div>

                          {/* Standard emojis grid */}
                          <div className="grid grid-cols-7 gap-1 max-h-36 overflow-y-auto p-1">
                            {EXTENDED_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onToggleReaction(msg.id, emoji);
                                  setReactionPickerMsgId(null);
                                }}
                                className="p-1 text-base hover:bg-[#21283a] rounded-lg transition-transform hover:scale-120 cursor-pointer text-center leading-none"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          {/* Custom emojis section */}
                          {customEmojis.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#22293d]">
                              <div className="text-[10px] uppercase font-bold text-indigo-400 px-1 mb-1.5">
                                Custom Emojis
                              </div>
                              <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1">
                                {customEmojis.map((ce) => (
                                  <button
                                    key={ce.id}
                                    type="button"
                                    onClick={() => {
                                      onToggleReaction(msg.id, `:${ce.name}:`);
                                      setReactionPickerMsgId(null);
                                    }}
                                    title={`:${ce.name}:`}
                                    className="p-1 hover:bg-[#21283a] rounded-lg transition-transform hover:scale-115 flex items-center justify-center cursor-pointer"
                                  >
                                    <img
                                      src={ce.url}
                                      alt={ce.name}
                                      className="w-5 h-5 object-contain"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Confirm Delete Popover */}
                      {isConfirmDeleteOpen && (
                        <div
                          className={`delete-confirm-container absolute z-30 bottom-full mb-2 p-2.5 bg-[#17111b] border border-red-500/40 rounded-xl shadow-2xl backdrop-blur-lg flex flex-col gap-2 animate-fadeIn ${
                            isMe ? 'right-0' : 'left-0'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs text-red-300 font-semibold">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete this message?</span>
                          </div>
                          <div className="flex items-center gap-1.5 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white bg-[#221820] rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(msg.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Main Message Content (Text or GIF) */}
                      {isGif ? (
                        <div
                          className={`overflow-hidden rounded-2xl shadow-lg border transition-all ${
                            isMe
                              ? 'bg-indigo-950/40 border-indigo-500/40 rounded-br-xs'
                              : 'bg-[#181d2a] border-[#262c3e] rounded-bl-xs'
                          }`}
                        >
                          <div className="relative max-w-xs sm:max-w-sm rounded-t-xl overflow-hidden bg-black/40">
                            <img
                              src={msg.mediaUrl || msg.content}
                              alt="GIF"
                              loading="lazy"
                              className="w-full max-h-72 object-contain"
                            />
                          </div>
                          {msg.content && !msg.content.startsWith('http') && msg.content !== 'GIF' && (
                            <div className="p-2.5 text-xs text-zinc-200">
                              {renderMessageContent(msg.content)}
                            </div>
                          )}
                          <div className="px-2.5 pb-2 pt-1 flex items-center justify-between text-[10px] text-zinc-400">
                            <span className="font-semibold uppercase tracking-wider text-indigo-400 text-[9px] bg-indigo-500/10 px-1.5 py-0.5 rounded">
                              GIF
                            </span>
                            <span>{formatMessageTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm transition-all ${
                            isMe
                              ? 'bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-indigo-600/10'
                              : 'bg-[#181d2a] text-zinc-100 border border-[#262c3e] rounded-bl-xs'
                          }`}
                        >
                          <div>{renderMessageContent(msg.content)}</div>

                          {isMe && (
                            <div className="text-[10px] text-indigo-200/80 text-right mt-1 font-medium">
                              {formatMessageTime(msg.createdAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stored Reaction Badges Display Under Message */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div
                        className={`flex flex-wrap items-center gap-1.5 mt-1.5 px-0.5 ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                          if (!Array.isArray(users) || users.length === 0) return null;
                          const hasReacted = users.includes(currentUser.username);
                          const customEmojiObj = customEmojis.find(
                            (ce) => `:${ce.name.toLowerCase()}:` === emoji.toLowerCase()
                          );

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onToggleReaction(msg.id, emoji)}
                              title={`${users.join(', ')} reacted with ${emoji}`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs transition-all cursor-pointer select-none ${
                                hasReacted
                                  ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-200 font-semibold shadow-xs'
                                  : 'bg-[#141824] hover:bg-[#1d2334] border-[#252c40] text-zinc-300'
                              }`}
                            >
                              {customEmojiObj ? (
                                <img
                                  src={customEmojiObj.url}
                                  alt={customEmojiObj.name}
                                  className="w-3.5 h-3.5 object-contain inline-block"
                                />
                              ) : (
                                <span className="text-sm leading-none">{emoji}</span>
                              )}
                              <span
                                className={`text-[11px] font-bold ${
                                  hasReacted ? 'text-indigo-300' : 'text-zinc-400'
                                }`}
                              >
                                {users.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* My Avatar */}
                  {isMe && (
                    <div className="w-8 h-8 shrink-0">
                      {!isChained ? (
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${palette.bg} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/10`}
                          title="You"
                        >
                          {initials}
                        </div>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={scrollBottomRef} />
      </div>

      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5 px-3 py-2 bg-[#1c2233]/90 hover:bg-[#252c42] text-xs font-semibold text-zinc-200 border border-[#2f3952] rounded-full shadow-lg backdrop-blur-md transition-all cursor-pointer animate-bounce"
        >
          <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
          <span>New messages</span>
        </button>
      )}
    </div>
  );
};
