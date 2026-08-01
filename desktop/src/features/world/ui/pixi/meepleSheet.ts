import {
  IDLE_FRAME_COUNT,
  WALK_FRAME_COUNT,
} from "../../model/spriteDirection";

// Procedural sprite sheets: each character gets a small canvas with drawn
// walk cycles (front and back views; screen-left movement mirrors the
// sprite at render time). Heads show the avatar when it loads, otherwise a
// colored disc with the display-name initial — so sheets can always be
// built synchronously and re-built when the avatar arrives.

export const FRAME_W = 26;
export const FRAME_H = 38;
/** Sheets are rasterized at this multiple of the logical frame size. */
export const SHEET_RES = 3;

export type SheetRow = "front-walk" | "back-walk" | "front-idle" | "back-idle";
export const SHEET_ROWS: readonly SheetRow[] = [
  "front-walk",
  "back-walk",
  "front-idle",
  "back-idle",
];

export function sheetFrameRect(
  row: SheetRow,
  frame: number,
): { x: number; y: number; width: number; height: number } {
  const rowIndex = SHEET_ROWS.indexOf(row);
  return {
    x: frame * FRAME_W * SHEET_RES,
    y: rowIndex * FRAME_H * SHEET_RES,
    width: FRAME_W * SHEET_RES,
    height: FRAME_H * SHEET_RES,
  };
}

type FrameSpec = {
  front: boolean;
  /** 0..3 for walk frames, -1 for idle frames. */
  walkPhase: number;
  /** Extra upward body offset in logical px (idle breathing / walk bob). */
  bob: number;
};

type SheetOptions = {
  color: string;
  initial: string;
  avatar?: CanvasImageSource | null;
};

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  spec: FrameSpec,
  options: SheetOptions,
) {
  const { color } = options;
  ctx.save();
  ctx.translate(originX, originY - spec.bob);

  const centerX = FRAME_W / 2;
  const headRadius = 7.5;
  const headCenterY = headRadius + 1.5 + spec.bob * 0.25;
  const torsoTop = headCenterY + headRadius - 2;
  const torsoW = 13;
  const torsoH = 12;
  const legTop = torsoTop + torsoH - 1;

  // Legs: alternate stride on walk frames, together on idle frames.
  const stride = spec.walkPhase === 0 ? 1 : spec.walkPhase === 2 ? -1 : 0;
  const legW = 3.6;
  const baseLegH = 8;
  ctx.fillStyle = "rgba(30, 30, 40, 0.78)";
  roundedRectPath(ctx, centerX - 4.6, legTop, legW, baseLegH + stride * 2, 1.6);
  ctx.fill();
  roundedRectPath(ctx, centerX + 1, legTop, legW, baseLegH - stride * 2, 1.6);
  ctx.fill();

  // Arms swing opposite the legs.
  ctx.fillStyle = color;
  roundedRectPath(
    ctx,
    centerX - torsoW / 2 - 2.6,
    torsoTop + 1.5 - stride * 1.4,
    2.8,
    8,
    1.4,
  );
  ctx.fill();
  roundedRectPath(
    ctx,
    centerX + torsoW / 2 - 0.2,
    torsoTop + 1.5 + stride * 1.4,
    2.8,
    8,
    1.4,
  );
  ctx.fill();

  // Torso with a simple vertical shade.
  const torsoGradient = ctx.createLinearGradient(
    0,
    torsoTop,
    0,
    torsoTop + torsoH,
  );
  torsoGradient.addColorStop(0, color);
  torsoGradient.addColorStop(1, "rgba(20, 20, 30, 0.55)");
  roundedRectPath(ctx, centerX - torsoW / 2, torsoTop, torsoW, torsoH, 4);
  ctx.fillStyle = color;
  ctx.fill();
  roundedRectPath(ctx, centerX - torsoW / 2, torsoTop, torsoW, torsoH, 4);
  ctx.fillStyle = torsoGradient;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head.
  ctx.beginPath();
  ctx.arc(centerX, headCenterY, headRadius, 0, Math.PI * 2);
  if (spec.front && options.avatar) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      options.avatar,
      centerX - headRadius,
      headCenterY - headRadius,
      headRadius * 2,
      headRadius * 2,
    );
    ctx.restore();
  } else if (spec.front) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = `700 ${headRadius + 1}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(options.initial, centerX, headCenterY + 0.5);
  } else {
    // Back of the head: darkened disc with a hair highlight.
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 15, 25, 0.42)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, headCenterY - 1.5, headRadius - 2.5, Math.PI, 0);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(centerX, headCenterY, headRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(10, 10, 20, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/** Rasterize the full sheet for one character. */
export function drawMeepleSheet(options: SheetOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W * SHEET_RES * WALK_FRAME_COUNT;
  canvas.height = FRAME_H * SHEET_RES * SHEET_ROWS.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(SHEET_RES, SHEET_RES);

  SHEET_ROWS.forEach((row, rowIndex) => {
    const front = row.startsWith("front");
    const idle = row.endsWith("idle");
    const frames = idle ? IDLE_FRAME_COUNT : WALK_FRAME_COUNT;
    for (let frame = 0; frame < frames; frame += 1) {
      drawFrame(
        ctx,
        frame * FRAME_W,
        rowIndex * FRAME_H,
        {
          front,
          walkPhase: idle ? -1 : frame,
          bob: idle ? frame * 0.8 : frame % 2 === 1 ? 1 : 0,
        },
        options,
      );
    }
  });
  return canvas;
}

/** Load an avatar for sheet heads; resolves null on any failure. */
export function loadAvatarImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
