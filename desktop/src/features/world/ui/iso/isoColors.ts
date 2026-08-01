import { hashString } from "../../model/roomLayout";

// Fixed accent hues used by the isometric scene in both themes. Activity
// green is the plumbob/working color; amber marks unread. Structural
// surfaces (floors, walls) use theme variables instead — see IsoRoomScene.

export const ACTIVITY_GREEN = "hsl(130 55% 45%)";
export const ACTIVITY_GREEN_SOFT = "hsl(130 55% 45% / 0.16)";
export const UNREAD_AMBER = "hsl(43 96% 50%)";
export const PLANT_GREEN = "hsl(140 40% 42%)";

/** Meeple body palette — soft, readable on both light and dark floors. */
const MEEPLE_PALETTE = [
  "hsl(4 72% 66%)",
  "hsl(27 84% 60%)",
  "hsl(47 80% 52%)",
  "hsl(146 42% 52%)",
  "hsl(188 58% 48%)",
  "hsl(214 72% 63%)",
  "hsl(262 55% 66%)",
  "hsl(330 60% 66%)",
] as const;

export function meepleColor(pubkey: string): string {
  return MEEPLE_PALETTE[hashString(pubkey) % MEEPLE_PALETTE.length];
}
