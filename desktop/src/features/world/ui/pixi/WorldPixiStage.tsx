import * as React from "react";
import { Application, Container, Rectangle } from "pixi.js";

import type { IsoPlot, ScreenBounds } from "../../model/isoMath";
import type { WorldCharacter } from "../../model/worldTypes";
import { type ActorTheme, CharacterActor } from "./CharacterActor";

export type WorldStageCamera = { x: number; y: number; scale: number };

export type StagePlacement = {
  character: WorldCharacter;
  plot: IsoPlot;
  u: number;
  v: number;
};

type WorldPixiStageProps = {
  placements: readonly StagePlacement[];
  bounds: ScreenBounds;
  camera: WorldStageCamera | null;
  nowMs: number;
  onOpenProfile: (pubkey: string) => void;
  /** Called when WebGL/WebGPU init fails; parent falls back to DOM sprites. */
  onUnavailable: () => void;
};

function readThemeColor(variable: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

function readActorTheme(): ActorTheme {
  return {
    labelColor: readThemeColor("--muted-foreground", "hsl(240 4% 40%)"),
    labelBackground: readThemeColor("--background", "hsl(0 0% 100%)"),
    labelBackgroundAlpha: 0.85,
    workColor: "hsl(130 55% 40%)",
  };
}

/**
 * Character layer rendered with PixiJS: procedurally-generated sprite-sheet
 * meeples animated from the shared ticker. Sits above the SVG room scene;
 * clicks that hit no character are re-dispatched to the DOM underneath so
 * floor buttons and nameplates keep working. The camera transform is applied
 * to the Pixi root container (not CSS), keeping sprites crisp at any zoom.
 */
export default function WorldPixiStage({
  placements,
  bounds,
  camera,
  nowMs,
  onOpenProfile,
  onUnavailable,
}: WorldPixiStageProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const appRef = React.useRef<Application | null>(null);
  const rootRef = React.useRef<Container | null>(null);
  const actorsRef = React.useRef<Map<string, CharacterActor>>(new Map());
  const pointerDownRef = React.useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = React.useState(false);

  const wasDrag = React.useCallback((clientX: number, clientY: number) => {
    const down = pointerDownRef.current;
    if (!down) return false;
    return Math.hypot(clientX - down.x, clientY - down.y) > 4;
  }, []);

  const onOpenProfileRef = React.useRef(onOpenProfile);
  onOpenProfileRef.current = onOpenProfile;
  const onUnavailableRef = React.useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const app = new Application();
    app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        appRef.current = app;
        host.appendChild(app.canvas);
        app.canvas.style.pointerEvents = "auto";
        app.canvas.addEventListener("pointerdown", (event) => {
          pointerDownRef.current = { x: event.clientX, y: event.clientY };
        });

        const root = new Container();
        root.sortableChildren = true;
        rootRef.current = root;
        app.stage.addChild(root);

        // Untargeted taps fall through to the DOM (floor doors, nameplates).
        app.stage.eventMode = "static";
        app.stage.hitArea = new Rectangle(
          -1_000_000,
          -1_000_000,
          2_000_000,
          2_000_000,
        );
        app.stage.on("pointertap", (event) => {
          if (event.target !== app.stage) return;
          const { clientX, clientY } = event.nativeEvent as PointerEvent;
          if (wasDrag(clientX, clientY)) return;
          const canvas = app.canvas;
          canvas.style.pointerEvents = "none";
          const element = document.elementFromPoint(clientX, clientY);
          canvas.style.pointerEvents = "auto";
          element?.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              clientX,
              clientY,
            }),
          );
        });

        app.ticker.add((ticker) => {
          for (const actor of actorsRef.current.values()) {
            actor.tick(ticker.deltaMS);
          }
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current();
      });

    return () => {
      cancelled = true;
      for (const actor of actorsRef.current.values()) {
        actor.destroy();
      }
      actorsRef.current.clear();
      rootRef.current = null;
      const current = appRef.current;
      appRef.current = null;
      setReady(false);
      current?.destroy(true, { children: true });
    };
  }, [wasDrag]);

  // Apply camera to the Pixi root container (re-applied once init completes).
  React.useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    if (!root || !camera) return;
    root.position.set(camera.x, camera.y);
    root.scale.set(camera.scale);
    root.visible = true;
  }, [camera, ready]);

  // Sync actors with the projected placements.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const theme = readActorTheme();
    const seen = new Set<string>();
    for (const placement of placements) {
      seen.add(placement.character.pubkey);
      let actor = actorsRef.current.get(placement.character.pubkey);
      if (!actor) {
        actor = new CharacterActor(placement.character, {
          bounds,
          reducedMotion,
          theme,
          onTap: (pubkey, clientX, clientY) => {
            if (wasDrag(clientX, clientY)) return;
            onOpenProfileRef.current(pubkey);
          },
        });
        actorsRef.current.set(placement.character.pubkey, actor);
        root.addChild(actor.root);
      }
      actor.updateData(placement.character, nowMs);
      actor.setPlacement(placement.plot, placement.u, placement.v);
    }
    for (const [pubkey, actor] of actorsRef.current) {
      if (!seen.has(pubkey)) {
        actor.destroy();
        actorsRef.current.delete(pubkey);
      }
    }
  }, [bounds, nowMs, placements, ready, wasDrag]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-testid="world-pixi-stage"
      ref={hostRef}
    />
  );
}
