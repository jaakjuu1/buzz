// Deterministic spatial helpers for the world renderer. Positions are pure
// functions of stable identity (pubkey) so characters stand still between
// renders and across sessions — motion in the world must come from state
// changes, never from re-rolled randomness.

/** FNV-1a 32-bit hash — cheap, stable, good enough spread for placement. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type CharacterOffset = { x: number; y: number };

/**
 * Where a character stands inside a room tile, as percentages of the tile's
 * floor area. `index`/`count` spread occupants across columns; the pubkey
 * hash jitters each one so rows don't look machine-stamped.
 */
export function characterOffset(
  pubkey: string,
  index: number,
  count: number,
): CharacterOffset {
  const hash = hashString(pubkey);
  const columns = Math.max(1, Math.min(count, 4));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const jitterX = ((hash & 0xff) / 255 - 0.5) * 10;
  const jitterY = (((hash >>> 8) & 0xff) / 255 - 0.5) * 8;
  const x = 14 + (column + 0.5) * (72 / columns) + jitterX;
  const y = 38 + row * 26 + jitterY;
  return {
    x: Math.min(88, Math.max(10, x)),
    y: Math.min(84, Math.max(30, y)),
  };
}

/** Rooms with a crowd get a double-wide tile so occupants stay readable. */
export function roomSpan(occupantCount: number): 1 | 2 {
  return occupantCount >= 4 ? 2 : 1;
}
