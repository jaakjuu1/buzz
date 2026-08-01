import { Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";

import {
  type IsoPlot,
  isoToScreen,
  type ScreenBounds,
} from "../../model/isoMath";
import { planPath, type WorldPoint } from "../../model/pathPlan";
import { hashString } from "../../model/roomLayout";
import {
  facingFromWorldDelta,
  IDLE_FRAME_COUNT,
  idleFrameAt,
  type SpriteFacing,
  WALK_FRAME_COUNT,
  walkFrameAt,
} from "../../model/spriteDirection";
import type { WorldCharacter } from "../../model/worldTypes";
import { meepleColor } from "../iso/isoColors";
import {
  drawMeepleSheet,
  FRAME_H,
  FRAME_W,
  loadAvatarImage,
  SHEET_RES,
  SHEET_ROWS,
  type SheetRow,
  sheetFrameRect,
} from "./meepleSheet";

const WALK_SPEED_PX_S = 95;
const WANDER_SPEED_PX_S = 40;
const WANDER_MIN_DELAY_MS = 9_000;
const WANDER_DELAY_SPREAD_MS = 16_000;
const SNAP_DISTANCE_PX = 2;
const PRESENCE_COLORS: Record<string, number> = {
  online: 0x22c55e,
  away: 0xf59e0b,
  offline: 0x9ca3af,
};

export type ActorTheme = {
  labelColor: string;
  labelBackground: string;
  labelBackgroundAlpha: number;
  workColor: string;
};

type Segment = {
  worldA: WorldPoint;
  worldB: WorldPoint;
  screenA: { sx: number; sy: number };
  screenB: { sx: number; sy: number };
  length: number;
};

/**
 * One character in the Pixi scene: sprite-sheet meeple with walk cycles,
 * shadow, presence dot, plumbob, and name label. Movement follows pathPlan
 * street routes and is advanced from the shared ticker; ambient wander is
 * confined to the character's current plot (decorative, never evidence).
 */
export class CharacterActor {
  readonly root = new Container();
  private readonly sprite = new Sprite();
  private readonly shadow = new Graphics();
  private readonly presenceDot = new Graphics();
  private readonly plumbob = new Graphics();
  private readonly labelBg = new Graphics();
  private readonly label: Text;
  private readonly elapsed: Text;

  private character: WorldCharacter;
  private readonly bounds: ScreenBounds;
  private readonly reducedMotion: boolean;
  private readonly theme: ActorTheme;

  private textures = new Map<SheetRow, Texture[]>();
  private sheetSource: Texture | null = null;
  private destroyed = false;

  private worldPos: WorldPoint | null = null;
  private plot: IsoPlot | null = null;
  private segments: Segment[] = [];
  private totalLength = 0;
  private traveled = 0;
  private speed = WALK_SPEED_PX_S;
  private walking = false;
  private facing: SpriteFacing = { front: true, mirrored: false };
  private walkClock = 0;
  private idleClock = 0;
  private plumbobClock = 0;
  private wanderEnabled = false;
  private wanderStep = 0;
  private wanderCountdown = 0;

  constructor(
    character: WorldCharacter,
    options: {
      bounds: ScreenBounds;
      reducedMotion: boolean;
      theme: ActorTheme;
      onTap: (pubkey: string, clientX: number, clientY: number) => void;
    },
  ) {
    this.character = character;
    this.bounds = options.bounds;
    this.reducedMotion = options.reducedMotion;
    this.theme = options.theme;

    this.shadow.ellipse(0, 0, 9, 3).fill({ color: 0x000000, alpha: 0.25 });
    this.root.addChild(this.shadow);

    this.sprite.anchor.set(0.5, 1);
    this.sprite.position.set(0, 2);
    this.root.addChild(this.sprite);

    this.root.addChild(this.presenceDot);
    this.root.addChild(this.plumbob);

    this.label = new Text({
      text: "",
      style: {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 9,
        fontWeight: "500",
        fill: options.theme.labelColor,
      },
      resolution: 3,
    });
    this.label.anchor.set(0.5, 0);
    this.elapsed = new Text({
      text: "",
      style: {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 8,
        fontWeight: "600",
        fill: options.theme.workColor,
      },
      resolution: 3,
    });
    this.elapsed.anchor.set(0.5, 0);
    this.root.addChild(this.labelBg);
    this.root.addChild(this.label);
    this.root.addChild(this.elapsed);

    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.hitArea = new Rectangle(-14, -FRAME_H - 4, 28, FRAME_H + 12);
    this.root.on("pointertap", (event) => {
      const native = event.nativeEvent as PointerEvent;
      options.onTap(this.character.pubkey, native.clientX, native.clientY);
    });

    this.rebuildSheet(null);
    if (character.avatarUrl) {
      void loadAvatarImage(character.avatarUrl).then((image) => {
        if (image && !this.destroyed) this.rebuildSheet(image);
      });
    }
    this.updateData(character, 0);
    this.resetWanderCountdown();
  }

  private rebuildSheet(avatar: CanvasImageSource | null) {
    const canvas = drawMeepleSheet({
      color: meepleColor(this.character.pubkey),
      initial: (this.character.displayName[0] ?? "?").toUpperCase(),
      avatar,
    });
    const nextSource = Texture.from(canvas);
    const nextTextures = new Map<SheetRow, Texture[]>();
    for (const row of SHEET_ROWS) {
      const frames = row.endsWith("idle") ? IDLE_FRAME_COUNT : WALK_FRAME_COUNT;
      const list: Texture[] = [];
      for (let frame = 0; frame < frames; frame += 1) {
        const rect = sheetFrameRect(row, frame);
        list.push(
          new Texture({
            source: nextSource.source,
            frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
          }),
        );
      }
      nextTextures.set(row, list);
    }
    this.sheetSource?.source.destroy();
    this.sheetSource = nextSource;
    this.textures = nextTextures;
    this.sprite.scale.set(
      (this.facing.mirrored ? -1 : 1) / SHEET_RES,
      1 / SHEET_RES,
    );
    this.applyFrame();
  }

  /** Refresh per-render data: label, working state, presence, wander gate. */
  updateData(character: WorldCharacter, nowMs: number) {
    this.character = character;
    const isWorking = character.state === "working";
    const dimmed = character.kind === "human" && character.state === "offline";

    this.label.text = character.isSelf
      ? `${character.displayName} (you)`
      : character.displayName;
    this.label.position.set(0, 6);
    const labelWidth = this.label.width + 8;
    this.labelBg
      .clear()
      .roundRect(-labelWidth / 2, 4, labelWidth, this.label.height + 4, 6)
      .fill({
        color: this.theme.labelBackground,
        alpha: this.theme.labelBackgroundAlpha,
      });

    if (isWorking && character.work) {
      const seconds = Math.max(
        0,
        Math.floor((nowMs - character.work.anchorAt) / 1_000),
      );
      const minutes = Math.floor(seconds / 60);
      this.elapsed.text =
        minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
      this.elapsed.position.set(0, 8 + this.label.height + 4);
      this.elapsed.visible = true;
    } else {
      this.elapsed.visible = false;
    }

    this.plumbob.visible = isWorking;
    this.sprite.alpha = dimmed ? 0.55 : 1;

    this.presenceDot.clear();
    if (character.kind === "human") {
      const color = PRESENCE_COLORS[character.state] ?? PRESENCE_COLORS.offline;
      this.presenceDot
        .circle(6, -FRAME_H + 16, 3)
        .fill({ color })
        .stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
    }

    // Working agents hold their desk spot facing the back wall.
    if (isWorking) {
      this.facing = { front: false, mirrored: false };
    }
    this.wanderEnabled = !isWorking && !dimmed && character.state !== "away";
    this.applyFrame();
  }

  private lastPlacementKey = "";

  setPlacement(plot: IsoPlot, u: number, v: number) {
    // Re-syncs arrive on every data render; only a genuinely new assignment
    // should interrupt the current walk or wander.
    const key = [plot.id, plot.x, plot.y, plot.w, plot.h, u, v].join(":");
    if (key === this.lastPlacementKey) return;
    this.lastPlacementKey = key;
    const target: WorldPoint = {
      x: plot.x + u * plot.w,
      y: plot.y + v * plot.h,
    };
    if (!this.worldPos) {
      this.plot = plot;
      this.teleportTo(target);
      return;
    }
    this.walkTo(target, plot, WALK_SPEED_PX_S);
  }

  private project(point: WorldPoint) {
    const screen = isoToScreen(point.x, point.y);
    return {
      sx: screen.sx - this.bounds.minX,
      sy: screen.sy - this.bounds.minY,
    };
  }

  private teleportTo(target: WorldPoint) {
    this.worldPos = target;
    this.segments = [];
    this.walking = false;
    const screen = this.project(target);
    this.root.position.set(screen.sx, screen.sy);
    this.root.zIndex = screen.sy;
    this.applyFrame();
  }

  private walkTo(target: WorldPoint, targetPlot: IsoPlot, speed: number) {
    const from = this.worldPos;
    const previousPlot = this.plot;
    this.plot = targetPlot;
    if (!from || this.reducedMotion) {
      this.teleportTo(target);
      this.resetWanderCountdown();
      return;
    }
    const waypoints = planPath(from, target, previousPlot, targetPlot);
    const segments: Segment[] = [];
    let total = 0;
    for (let i = 1; i < waypoints.length; i += 1) {
      const screenA = this.project(waypoints[i - 1]);
      const screenB = this.project(waypoints[i]);
      const length = Math.hypot(
        screenB.sx - screenA.sx,
        screenB.sy - screenA.sy,
      );
      segments.push({
        worldA: waypoints[i - 1],
        worldB: waypoints[i],
        screenA,
        screenB,
        length,
      });
      total += length;
    }
    if (total < SNAP_DISTANCE_PX) {
      this.teleportTo(target);
      this.resetWanderCountdown();
      return;
    }
    this.segments = segments;
    this.totalLength = total;
    this.traveled = 0;
    this.speed = speed;
    this.walking = true;
    this.walkClock = 0;
  }

  private resetWanderCountdown() {
    this.wanderCountdown =
      WANDER_MIN_DELAY_MS +
      (hashString(`${this.character.pubkey}:${this.wanderStep}`) %
        WANDER_DELAY_SPREAD_MS);
  }

  private startWander() {
    const plot = this.plot;
    if (!plot) return;
    this.wanderStep += 1;
    const hash = hashString(`${this.character.pubkey}#${this.wanderStep}`);
    const u = 0.15 + ((hash & 0xffff) / 0xffff) * 0.7;
    const v = 0.35 + (((hash >>> 16) & 0xffff) / 0xffff) * 0.45;
    this.walkTo(
      { x: plot.x + u * plot.w, y: plot.y + v * plot.h },
      plot,
      WANDER_SPEED_PX_S,
    );
  }

  /** Advance movement and animation by `deltaMS`. */
  tick(deltaMS: number) {
    if (this.walking) {
      this.walkClock += deltaMS;
      this.traveled += (this.speed * deltaMS) / 1_000;
      let remaining = Math.min(this.traveled, this.totalLength);
      let segment = this.segments[this.segments.length - 1];
      for (const candidate of this.segments) {
        if (remaining <= candidate.length) {
          segment = candidate;
          break;
        }
        remaining -= candidate.length;
      }
      const t = segment.length === 0 ? 1 : remaining / segment.length;
      this.worldPos = {
        x: segment.worldA.x + (segment.worldB.x - segment.worldA.x) * t,
        y: segment.worldA.y + (segment.worldB.y - segment.worldA.y) * t,
      };
      const sx =
        segment.screenA.sx + (segment.screenB.sx - segment.screenA.sx) * t;
      const sy =
        segment.screenA.sy + (segment.screenB.sy - segment.screenA.sy) * t;
      this.root.position.set(sx, sy);
      this.root.zIndex = sy;
      this.facing = facingFromWorldDelta(
        segment.worldB.x - segment.worldA.x,
        segment.worldB.y - segment.worldA.y,
      );
      if (this.traveled >= this.totalLength) {
        this.walking = false;
        this.idleClock = 0;
        if (this.character.state !== "working") {
          this.facing = { front: true, mirrored: false };
        } else {
          this.facing = { front: false, mirrored: false };
        }
        this.resetWanderCountdown();
      }
    } else {
      this.idleClock += deltaMS;
      if (this.wanderEnabled && !this.reducedMotion) {
        this.wanderCountdown -= deltaMS;
        if (this.wanderCountdown <= 0) {
          this.startWander();
        }
      }
    }

    if (this.plumbob.visible) {
      this.plumbobClock += deltaMS;
      const bob = Math.sin(this.plumbobClock / 260) * 2;
      this.plumbob
        .clear()
        .poly([0, -6, 4, 0, 0, 6, -4, 0])
        .fill({ color: 0x3ec96a })
        .stroke({ color: 0x1d7a3f, width: 1 });
      this.plumbob.position.set(0, -FRAME_H - 8 + bob);
    }

    this.applyFrame();
  }

  private applyFrame() {
    const row: SheetRow = this.walking
      ? this.facing.front
        ? "front-walk"
        : "back-walk"
      : this.facing.front
        ? "front-idle"
        : "back-idle";
    const frames = this.textures.get(row);
    if (!frames || frames.length === 0) return;
    const index = this.walking
      ? walkFrameAt(this.walkClock)
      : this.reducedMotion
        ? 0
        : idleFrameAt(this.idleClock);
    const texture = frames[Math.min(index, frames.length - 1)];
    if (this.sprite.texture !== texture) {
      this.sprite.texture = texture;
    }
    const direction = this.facing.mirrored ? -1 : 1;
    if (Math.sign(this.sprite.scale.x) !== direction) {
      this.sprite.scale.x = direction / SHEET_RES;
    }
  }

  destroy() {
    this.destroyed = true;
    this.root.destroy({ children: true });
    this.sheetSource?.source.destroy();
  }
}

export const ACTOR_FRAME_SIZE = { width: FRAME_W, height: FRAME_H };
