import assert from "node:assert/strict";
import test from "node:test";

import { characterOffset, hashString } from "./roomLayout.ts";

test("hashString is deterministic and spreads distinct inputs", () => {
  assert.equal(hashString("alice"), hashString("alice"));
  assert.notEqual(hashString("alice"), hashString("bob"));
});

test("characterOffset is stable for the same pubkey and slot", () => {
  const a = characterOffset("a".repeat(64), 0, 3);
  const b = characterOffset("a".repeat(64), 0, 3);
  assert.deepEqual(a, b);
});

test("characterOffset stays inside the plot floor", () => {
  for (let count = 1; count <= 9; count += 1) {
    for (let index = 0; index < count; index += 1) {
      const { x, y } = characterOffset(`pk-${index}`, index, count);
      assert.ok(x >= 10 && x <= 88, `x out of bounds: ${x}`);
      assert.ok(y >= 30 && y <= 84, `y out of bounds: ${y}`);
    }
  }
});

test("occupants in the same plot get distinct slots", () => {
  const first = characterOffset("a".repeat(64), 0, 2);
  const second = characterOffset("b".repeat(64), 1, 2);
  assert.notDeepEqual(first, second);
});

test("wider plots can spread occupants across more columns", () => {
  // With 8 columns the 8th occupant still sits on the first row (y stays in
  // the first band), whereas 4 columns would wrap it to a second row.
  const wide = characterOffset("c".repeat(64), 7, 8, 8);
  const narrow = characterOffset("c".repeat(64), 7, 8, 4);
  assert.ok(wide.y < narrow.y);
});
