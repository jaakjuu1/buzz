// Sprite-sheet facing and walk-cycle math, kept pure for unit tests.
// World axes: +x runs screen right-down, +y runs screen left-down, so a
// character moves "toward the camera" (front rows of the sheet) whenever
// dx + dy > 0, and screen-leftward (mirrored) whenever dx - dy < 0.

export type SpriteFacing = {
  /** True when the character faces the camera (front sprite rows). */
  front: boolean;
  /** True when the sprite should be mirrored (moving screen-left). */
  mirrored: boolean;
};

export function facingFromWorldDelta(dx: number, dy: number): SpriteFacing {
  if (dx === 0 && dy === 0) {
    return { front: true, mirrored: false };
  }
  return {
    front: dx + dy >= 0,
    mirrored: dx - dy < 0,
  };
}

export const WALK_FRAME_COUNT = 4;
export const WALK_FRAME_MS = 130;
export const IDLE_FRAME_COUNT = 2;
export const IDLE_FRAME_MS = 700;

/** Current frame of the looping walk cycle at `elapsedMs`. */
export function walkFrameAt(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / WALK_FRAME_MS) % WALK_FRAME_COUNT;
}

/** Current frame of the slow idle "breathing" loop at `elapsedMs`. */
export function idleFrameAt(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / IDLE_FRAME_MS) % IDLE_FRAME_COUNT;
}
