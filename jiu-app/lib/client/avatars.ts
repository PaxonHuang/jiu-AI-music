// Avatar generation for community posts and the me page picker.
//
// Two pieces live here:
//   1. generateAvatar(seed) — a deterministic, friendly-looking emoji + tone
//      pair based on any string seed (we hash the post's authorId or a
//      picked emoji). Same seed → same avatar, across sessions.
//   2. AVATAR_CHOICES — the curated set the user can pick from on the me
//      page. Every entry is a single emoji that reads well at the 56px
//      circle size used by the header + community cards.

const AVATAR_CHOICES = [
  '🐦', '🦜', '🦉', '🐧', '🐤', '🦆', '🦢', '🦩',
  '🐰', '🐻', '🐼', '🦊', '🐯', '🐨', '🐺', '🦁',
  '🐢', '🦋', '🐝', '🐞', '🦄', '🐙', '🦋', '🌟',
  '🌸', '🌈', '🍀', '🌻', '🌼', '🌷', '🌺', '🍎',
] as const;

const AVATAR_TONES = [
  'bg-[#DFF3EF]', 'bg-[#FFE9D7]', 'bg-[#F4EEFF]', 'bg-[#FFF1D8]',
  'bg-[#EAF5EA]', 'bg-[#FFEFEA]', 'bg-[#E8F5EC]', 'bg-[#FFF0E1]',
  'bg-[#FFEAEF]', 'bg-[#F0E9FF]', 'bg-[#E8F5F0]', 'bg-[#FFF5E8]',
] as const;

export type AvatarSeed = string | null | undefined;

/**
 * Deterministic emoji + tone background for any seed string. Hashing is a
 * tiny djb2-variant so we don't pull in a crypto dependency for what is
 * purely a visual diversification.
 */
export function generateAvatar(seed: AvatarSeed): {
  emoji: string;
  tone: string;
} {
  const fallback = AVATAR_CHOICES[0];
  const fallbackTone = AVATAR_TONES[0];
  if (!seed) return { emoji: fallback, tone: fallbackTone };

  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  // Force to unsigned 32-bit.
  hash = hash >>> 0;

  const emoji = AVATAR_CHOICES[hash % AVATAR_CHOICES.length];
  const tone = AVATAR_TONES[(hash >>> 8) % AVATAR_TONES.length];
  return { emoji, tone };
}

export { AVATAR_CHOICES };