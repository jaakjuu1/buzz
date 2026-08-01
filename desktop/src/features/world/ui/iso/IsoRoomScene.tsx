import {
  type IsoPlot,
  isoToScreen,
  plotCorners,
  SLAB_H,
  WALL_H,
} from "../../model/isoMath";
import { hashString } from "../../model/roomLayout";
import { PLANT_GREEN } from "./isoColors";

// SVG architecture for one plot: cutaway room in the classic Sims style —
// floor slab, two back walls, per-tile floor grid, a desk and a plant.
// Purely decorative geometry; all interactivity lives in the HTML overlay
// layer (RoomOverlay), so this component stays free of event handlers.

type ScreenPointLike = { sx: number; sy: number };

function pts(...points: ScreenPointLike[]): string {
  return points.map((point) => `${point.sx},${point.sy}`).join(" ");
}

function up(point: ScreenPointLike, by: number): ScreenPointLike {
  return { sx: point.sx, sy: point.sy - by };
}

function down(point: ScreenPointLike, by: number): ScreenPointLike {
  return { sx: point.sx, sy: point.sy + by };
}

/**
 * Surface shade: the card color darkened toward the foreground by `pct`
 * percent. Gives every iso face readable contrast in both themes without
 * hardcoding light/dark colors.
 */
function shade(pct: number): string {
  return `color-mix(in oklab, hsl(var(--card)), hsl(var(--foreground)) ${pct}%)`;
}

/** Extruded box (desk etc.) at a world-space rectangle, `height` px tall. */
function IsoBox({
  x,
  y,
  w,
  h,
  height,
  topFill,
  leftFill,
  rightFill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  topFill: string;
  leftFill: string;
  rightFill: string;
}) {
  const c00 = isoToScreen(x, y);
  const c10 = isoToScreen(x + w, y);
  const c11 = isoToScreen(x + w, y + h);
  const c01 = isoToScreen(x, y + h);
  const stroke = "hsl(var(--border))";
  return (
    <g>
      <polygon
        fill={leftFill}
        points={pts(c01, c11, up(c11, height), up(c01, height))}
        stroke={stroke}
        strokeWidth={0.5}
      />
      <polygon
        fill={rightFill}
        points={pts(c11, c10, up(c10, height), up(c11, height))}
        stroke={stroke}
        strokeWidth={0.5}
      />
      <polygon
        fill={topFill}
        points={pts(
          up(c00, height),
          up(c10, height),
          up(c11, height),
          up(c01, height),
        )}
        stroke={stroke}
        strokeWidth={0.5}
      />
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  const base = isoToScreen(x, y);
  return (
    <g>
      <polygon
        fill={shade(18)}
        points={pts(
          { sx: base.sx - 5, sy: base.sy - 8 },
          { sx: base.sx + 5, sy: base.sy - 8 },
          { sx: base.sx + 3.5, sy: base.sy },
          { sx: base.sx - 3.5, sy: base.sy },
        )}
        stroke="hsl(var(--border))"
        strokeWidth={0.5}
      />
      <circle cx={base.sx - 4} cy={base.sy - 14} fill={PLANT_GREEN} r={5} />
      <circle cx={base.sx + 4} cy={base.sy - 15} fill={PLANT_GREEN} r={5.5} />
      <circle cx={base.sx} cy={base.sy - 20} fill="hsl(140 40% 48%)" r={5.5} />
    </g>
  );
}

type IsoRoomSceneProps = {
  plot: IsoPlot;
  working: boolean;
};

export function IsoRoomScene({ plot, working }: IsoRoomSceneProps) {
  const { c00, c10, c11, c01 } = plotCorners(plot);
  const isLounge = plot.kind === "lounge";
  const floorFill = isLounge ? shade(7) : shade(3);
  const gridStroke = "hsl(var(--border) / 0.5)";
  const center = {
    sx: (c01.sx + c10.sx) / 2,
    sy: (c00.sy + c11.sy) / 2,
  };

  const gridLines: string[] = [];
  for (let i = 1; i < plot.w; i += 1) {
    gridLines.push(
      pts(
        isoToScreen(plot.x + i, plot.y),
        isoToScreen(plot.x + i, plot.y + plot.h),
      ),
    );
  }
  for (let j = 1; j < plot.h; j += 1) {
    gridLines.push(
      pts(
        isoToScreen(plot.x, plot.y + j),
        isoToScreen(plot.x + plot.w, plot.y + j),
      ),
    );
  }

  // Deterministic prop placement: the plant swaps corners per channel so the
  // campus doesn't look copy-pasted.
  const plantOnRight = hashString(plot.id) % 2 === 0;

  return (
    <g data-iso-room={plot.id}>
      {/* Floor slab sides (gives the ground plate thickness). */}
      <polygon
        fill={shade(34)}
        points={pts(c01, c11, down(c11, SLAB_H), down(c01, SLAB_H))}
      />
      <polygon
        fill={shade(24)}
        points={pts(c11, c10, down(c10, SLAB_H), down(c11, SLAB_H))}
      />
      {/* Floor. */}
      <polygon
        fill={floorFill}
        points={pts(c00, c10, c11, c01)}
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
      {gridLines.map((line) => (
        <polyline
          fill="none"
          key={line}
          points={line}
          stroke={gridStroke}
          strokeWidth={0.75}
        />
      ))}
      {working ? (
        <ellipse
          className="animate-pulse"
          cx={center.sx}
          cy={center.sy}
          fill="url(#world-activity-glow)"
          rx={(c10.sx - c01.sx) * 0.34}
          ry={(c11.sy - c00.sy) * 0.34}
        />
      ) : null}
      {!isLounge ? (
        <>
          {/* Back walls (cutaway view — front walls stay open). */}
          <polygon
            fill={shade(16)}
            points={pts(c01, c00, up(c00, WALL_H), up(c01, WALL_H))}
            stroke="hsl(var(--border))"
            strokeWidth={0.75}
          />
          <polygon
            fill={shade(9)}
            points={pts(c00, c10, up(c10, WALL_H), up(c00, WALL_H))}
            stroke="hsl(var(--border))"
            strokeWidth={0.75}
          />
          {/* Wall-floor junction shading. */}
          <polyline
            fill="none"
            points={pts(c01, c00, c10)}
            stroke="hsl(var(--foreground) / 0.12)"
            strokeWidth={2}
          />
          <IsoBox
            height={15}
            leftFill={shade(22)}
            rightFill={shade(14)}
            topFill={shade(8)}
            w={1.7}
            h={0.9}
            x={plot.x + 0.6}
            y={plot.y + 0.7}
          />
          <Plant
            x={plantOnRight ? plot.x + plot.w - 0.7 : plot.x + 0.5}
            y={plot.y + plot.h - 0.6}
          />
        </>
      ) : (
        <>
          {/* Lounge rug. */}
          <ellipse
            cx={center.sx}
            cy={center.sy}
            fill={shade(12)}
            rx={Math.min((c10.sx - c01.sx) * 0.28, 100)}
            ry={Math.min((c11.sy - c00.sy) * 0.3, 40)}
            stroke="hsl(var(--border) / 0.7)"
            strokeWidth={1}
          />
          <Plant x={plot.x + 0.5} y={plot.y + plot.h - 0.5} />
          <Plant x={plot.x + plot.w - 0.6} y={plot.y + plot.h - 0.5} />
        </>
      )}
    </g>
  );
}
