import assert from "node:assert/strict";
import test from "node:test";

import {
  facingFromWorldDelta,
  IDLE_FRAME_COUNT,
  idleFrameAt,
  WALK_FRAME_COUNT,
  WALK_FRAME_MS,
  walkFrameAt,
} from "./spriteDirection.ts";

test("moving +x (screen right-down) faces front, unmirrored", () => {
  assert.deepEqual(facingFromWorldDelta(1, 0), {
    front: true,
    mirrored: false,
  });
});

test("moving +y (screen left-down) faces front, mirrored", () => {
  assert.deepEqual(facingFromWorldDelta(0, 1), { front: true, mirrored: true });
});

test("moving -x (screen left-up) faces away, mirrored", () => {
  assert.deepEqual(facingFromWorldDelta(-1, 0), {
    front: false,
    mirrored: true,
  });
});

test("moving -y (screen right-up) faces away, unmirrored", () => {
  assert.deepEqual(facingFromWorldDelta(0, -1), {
    front: false,
    mirrored: false,
  });
});

test("standing still defaults to front, unmirrored", () => {
  assert.deepEqual(facingFromWorldDelta(0, 0), {
    front: true,
    mirrored: false,
  });
});

test("walk cycle loops through every frame in order", () => {
  const seen = [];
  for (let frame = 0; frame < WALK_FRAME_COUNT; frame += 1) {
    seen.push(walkFrameAt(frame * WALK_FRAME_MS + 1));
  }
  assert.deepEqual(seen, [0, 1, 2, 3]);
  assert.equal(walkFrameAt(WALK_FRAME_COUNT * WALK_FRAME_MS + 1), 0);
});

test("idle loop alternates its frames and clamps negative time", () => {
  assert.equal(idleFrameAt(-100), 0);
  const frames = new Set();
  for (let ms = 0; ms < 3000; ms += 100) {
    frames.add(idleFrameAt(ms));
  }
  assert.equal(frames.size, IDLE_FRAME_COUNT);
});
