import React, { useState, useRef } from 'react';
import { Plus, Search, Smile, User, PawPrint, Utensils, Trophy, Compass, Lightbulb, Hash } from 'lucide-react';
import type { CustomMedia } from '../types/chat.ts';

interface EmojiPickerProps {
  customEmojis: CustomMedia[];
  onSelectEmoji: (emojiText: string) => void;
  onOpenUpload: (file: File) => void;
  onClose: () => void;
}

// Comprehensive standard emoji sections matching Discord / standard platforms
const STANDARD_EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '🫠', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
      '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒',
      '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤',
      '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢',
      '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
      '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'
    ],
  },
  {
    id: 'people',
    name: 'People & Body',
    icon: User,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊',
      '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪',
      '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️'
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: PawPrint,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷',
      '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
      '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂',
      '🐢', '🐍', '🦎', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈',
      '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘',
      '🌲', '🌳', '🌴', '🪵', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴', '🍃', '🍂', '🍁', '🍄',
      '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '⭐', '🌟', '✨'
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: Utensils,
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
      '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄',
      '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇',
      '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮',
      '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
      '🍤', '🍙', '🍚', '🍘', '🍥', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭',
      '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🧃', '🥤'
    ],
  },
  {
    id: 'activities',
    name: 'Activities & Sports',
    icon: Trophy,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒',
      '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹',
      '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🏇',
      '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
      '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
      '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: Compass,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜',
      '🛵', '🏍️', '🛺', '🚲', '🛴', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧',
      '⚓', '🛟', '⛵', '🚤', '🛳️', '⛴️', '🚢', '✈️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟',
      '🚠', '🚡', '🛰️', '🚀', '🛸', '🪐', '🌠', '🌌', '⛱️', '🎆', '🎇', '🎑', '🗾', '🗿',
      '🗼', '🗽', '🕌', '🕋', '🛕', '⛪', '🏛️', '🏗️', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣'
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: Lightbulb,
    emojis: [
      '📱', '📲', '☎️', '📞', '📟', '📠', '🔋', '🪫', '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️',
      '🖲️', '💽', '💾', '💿', '📀', '🎥', '🎞️', '📽️', '📷', '📸', '📹', '📺', '📻', '🎙️',
      '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️',
      '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧',
      '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨',
      '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈',
      '🧲', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🚪', '🛗',
      '🪞', '🪟', '🛏️', '🛋️', '🪑', '🚽', '🪠', '🚿', '🛁', '🪤', '🧴', '🧷', '🧹', '🧺',
      '🧻', '🪣', '🧼', '🫧', '🪥', '🧽', '🧯', '🛒', '🚬', '⚰️', '🪦', '⚱️', '🏺'
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: Hash,
    emojis: [
      '❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '💔', '❤️‍🔥',
      '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️',
      '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍',
      '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶',
      '🈚', '🈸', '🈺', '🈷️', '✴️', '♨️', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
      '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
      '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅',
      '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎',
      '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  customEmojis,
  onSelectEmoji,
  onOpenUpload,
}) => {
  const [search, setSearch] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenUpload(file);
      e.target.value = '';
    }
  };

  const filteredCustom = customEmojis.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 sm:w-96 bg-[#131724] border border-[#262f44] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 z-40 select-none animate-fadeIn">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Search */}
      <div className="p-3 border-b border-[#20273a] bg-[#161c2d] flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full bg-[#0d101a] border border-[#242c3f] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#20273a] bg-[#0f131f] overflow-x-auto text-xs scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeCategory === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a2133]'
          }`}
        >
          All
        </button>
        {STANDARD_EMOJI_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a2133]'
              }`}
              title={cat.name}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>

      {/* Emoji Scroll Area */}
      <div className="p-3 overflow-y-auto max-h-72 space-y-4">
        {/* TOP SECTION: 67 Gang */}
        {(activeCategory === 'all' || activeCategory === '67gang') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] text-white font-black">
                    67
                  </span>
                  67 Gang
                </span>
                <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded-full">
                  {customEmojis.length}
                </span>
              </div>

              {/* PLUS BUTTON: Upload Custom Emoji */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload custom 67 Gang emoji (plain image)"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Upload Custom Emoji</span>
              </button>
            </div>

            {/* Custom 67 Gang Emojis Grid */}
            {filteredCustom.length > 0 ? (
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 bg-[#0c0f18] rounded-xl border border-[#1f2638]">
                {filteredCustom.map((emoji) => (
                  <button
                    key={emoji.id}
                    type="button"
                    onClick={() => onSelectEmoji(`:${emoji.name}:`)}
                    title={`:${emoji.name}:`}
                    className="group relative p-1.5 rounded-xl hover:bg-indigo-600/20 hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <img
                      src={emoji.url}
                      alt={emoji.name}
                      className={`w-7 h-7 object-contain ${
                        emoji.shape === 'circle' ? 'rounded-full' : emoji.shape === 'rounded' ? 'rounded-lg' : 'rounded-xs'
                      }`}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-[#0d101a] rounded-xl border border-dashed border-[#2b354d] hover:border-indigo-500/60 text-center cursor-pointer transition-colors group"
              >
                <p className="text-[11px] text-zinc-400 group-hover:text-zinc-200">
                  No custom emojis yet. Click <span className="text-indigo-400 font-bold">+ Upload Custom Emoji</span> to add one for 67 Gang!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Standard Normal Sections */}
        {STANDARD_EMOJI_CATEGORIES.map((cat) => {
          if (activeCategory !== 'all' && activeCategory !== cat.id) return null;

          const filteredEmojis = cat.emojis.filter((e) => !search || e.includes(search));
          if (filteredEmojis.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                <cat.icon className="w-3 h-3 text-indigo-400" />
                <span>{cat.name}</span>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSelectEmoji(emoji)}
                    className="p-1.5 text-xl rounded-xl hover:bg-[#20273a] hover:scale-115 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
