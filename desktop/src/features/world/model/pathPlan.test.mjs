import assert from "node:assert/strict";
import test from "node:test";

import {
  pathLength,
  planPath,
  plotDoor,
  pointAlongPath,
  STREET_MARGIN,
} from "./pathPlan.ts";

const ROOM_A = { id: "a", kind: "room", x: 0, y: 0, w: 7, h: 6 };
const ROOM_B = { id: "b", kind: "room", x: 10, y: 0, w: 7, h: 6 };
const ROOM_C = { id: "c", kind: "room", x: 10, y: 10, w: 7, h: 6 };

function insidePlot(point, plot) {
  return (
    point.x > plot.x &&
    point.x < plot.x + plot.w &&
    point.y > plot.y &&
    point.y < plot.y + plot.h
  );
}

test("same-plot moves are a straight line", () => {
  const path = planPath({ x: 1, y: 1 }, { x: 5, y: 4 }, ROOM_A, ROOM_A);
  assert.deepEqual(path, [
    { x: 1, y: 1 },
    { x: 5, y: 4 },
  ]);
});

test("plotDoor sits centered just outside the front edge", () => {
  const door = plotDoor(ROOM_A);
  assert.equal(door.x, ROOM_A.x + ROOM_A.w / 2);
  assert.equal(door.y, ROOM_A.y + ROOM_A.h + STREET_MARGIN);
});

test("cross-plot routes leave through doors and never cut through rooms", () => {
  const from = { x: 3, y: 3 };
  const to = { x: 13, y: 13 };
  const path = planPath(from, to, ROOM_A, ROOM_C);
  assert.ok(path.length >= 4);
  // Every intermediate waypoint stays out of every room's interior.
  for (const point of path.slice(1, -1)) {
    for (const plot of [ROOM_A, ROOM_B, ROOM_C]) {
      assert.ok(
        !insidePlot(point, plot),
        `waypoint ${JSON.stringify(point)} cuts through ${plot.id}`,
      );
    }
  }
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
});

test("same-row routes collapse duplicate corridor waypoints", () => {
  const path = planPath({ x: 3, y: 3 }, { x: 13, y: 3 }, ROOM_A, ROOM_B);
  for (let i = 1; i < path.length; i += 1) {
    const dx = Math.abs(path[i].x - path[i - 1].x);
    const dy = Math.abs(path[i].y - path[i - 1].y);
    assert.ok(dx > 0.01 || dy > 0.01, "duplicate waypoint survived");
  }
});

test("pathLength and pointAlongPath agree on endpoints", () => {
  const points = [
    { sx: 0, sy: 0 },
    { sx: 30, sy: 40 },
    { sx: 30, sy: 100 },
  ];
  const total = pathLength(points);
  assert.equal(total, 110);
  assert.deepEqual(pointAlongPath(points, 0), { sx: 0, sy: 0 });
  assert.deepEqual(pointAlongPath(points, total), { sx: 30, sy: 100 });
  const mid = pointAlongPath(points, 50);
  assert.deepEqual(mid, { sx: 30, sy: 40 });
});
