// Color palettes for members
const COLOR_PALETTES = [
  { bg: 'from-violet-600 to-indigo-600', text: 'text-violet-400', badge: 'bg-violet-500/10 border-violet-500/30 text-violet-300' },
  { bg: 'from-emerald-600 to-teal-600', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
  { bg: 'from-amber-600 to-orange-600', text: 'text-amber-400', badge: 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
  { bg: 'from-rose-600 to-pink-600', text: 'text-rose-400', badge: 'bg-rose-500/10 border-rose-500/30 text-rose-300' },
  { bg: 'from-cyan-600 to-blue-600', text: 'text-cyan-400', badge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' },
  { bg: 'from-fuchsia-600 to-purple-600', text: 'text-fuchsia-400', badge: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300' },
];

export function getMemberPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
