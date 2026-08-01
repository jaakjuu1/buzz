import assert from "node:assert/strict";
import test from "node:test";

import { isoToScreen, layoutScreenBounds, plotCorners } from "./isoMath.ts";
import {
  buildWorldLayout,
  LOUNGE_PLOT_ID,
  sortPlotsForPaint,
} from "./worldLayout.ts";

function room(id, occupantCount = 0) {
  return { channelId: id, occupantCount };
}

test("isoToScreen projects 2:1 isometric axes", () => {
  assert.deepEqual(isoToScreen(0, 0), { sx: 0, sy: 0 });
  const east = isoToScreen(1, 0);
  const south = isoToScreen(0, 1);
  assert.ok(east.sx > 0 && east.sy > 0);
  assert.ok(south.sx < 0 && south.sy > 0);
  assert.equal(east.sy, south.sy);
});

test("layout is deterministic and plots do not overlap", () => {
  const rooms = [room("a"), room("b", 5), room("c"), room("d"), room("e")];
  const first = buildWorldLayout(rooms, 6);
  const second = buildWorldLayout(rooms, 6);
  assert.deepEqual(first, second);

  for (const plotA of first.all) {
    for (const plotB of first.all) {
      if (plotA.id === plotB.id) continue;
      const separated =
        plotA.x + plotA.w <= plotB.x ||
        plotB.x + plotB.w <= plotA.x ||
        plotA.y + plotA.h <= plotB.y ||
        plotB.y + plotB.h <= plotA.y;
      assert.ok(separated, `${plotA.id} overlaps ${plotB.id}`);
    }
  }
});

test("crowded rooms get a bigger footprint", () => {
  const layout = buildWorldLayout([room("quiet"), room("busy", 6)], 0);
  const quiet = layout.plots.get("quiet");
  const busy = layout.plots.get("busy");
  assert.ok(busy.w > quiet.w);
  assert.ok(busy.h > quiet.h);
});

test("lounge sits in front of every room and scales with its crowd", () => {
  const layout = buildWorldLayout([room("a"), room("b"), room("c")], 2);
  assert.ok(layout.loungePlot);
  assert.equal(layout.loungePlot.id, LOUNGE_PLOT_ID);
  for (const plot of layout.plots.values()) {
    assert.ok(plot.y + plot.h <= layout.loungePlot.y);
  }
  const crowded = buildWorldLayout([room("a"), room("b"), room("c")], 10);
  assert.ok(crowded.loungePlot.w > layout.loungePlot.w);
});

test("lounge is omitted when empty", () => {
  const layout = buildWorldLayout([room("a")], 0);
  assert.equal(layout.loungePlot, null);
  assert.equal(layout.all.length, 1);
});

test("paint order sorts back-to-front", () => {
  const layout = buildWorldLayout([room("a"), room("b"), room("c")], 3);
  const sorted = sortPlotsForPaint(layout.all);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(
      sorted[i - 1].x + sorted[i - 1].y <= sorted[i].x + sorted[i].y,
      "paint order regressed",
    );
  }
});

test("screen bounds contain every plot corner with padding", () => {
  const layout = buildWorldLayout([room("a"), room("b", 5)], 4);
  const bounds = layoutScreenBounds(layout.all);
  for (const plot of layout.all) {
    const { c00, c10, c11, c01 } = plotCorners(plot);
    for (const corner of [c00, c10, c11, c01]) {
      assert.ok(corner.sx > bounds.minX && corner.sx < bounds.maxX);
      assert.ok(corner.sy > bounds.minY && corner.sy < bounds.maxY);
    }
  }
});
