import * as React from "react";

import {
  type IsoPlot,
  isoToScreen,
  type ScreenBounds,
} from "../../model/isoMath";
import { planPath, type WorldPoint } from "../../model/pathPlan";
import { hashString } from "../../model/roomLayout";

// Movement controller for one character sprite. Positions are written to
// the DOM directly from a requestAnimationFrame loop (no React re-render
// per frame); React state only tracks the boolean walking flag that drives
// the leg animation. Routes come from planPath, so cross-room walks follow
// the streets instead of cutting through walls.
//
// Ambient wander is deliberately confined to the plot the projection placed
// the character in: it makes the world feel alive without ever claiming
// activity that isn't real.

const WALK_SPEED_PX_S = 95;
const WANDER_SPEED_PX_S = 40;
const MIN_WALK_MS = 160;
const MAX_WALK_MS = 9_000;
const WANDER_MIN_DELAY_MS = 9_000;
const WANDER_DELAY_SPREAD_MS = 16_000;
const SNAP_DISTANCE_PX = 2;

type MovementInput = {
  plot: IsoPlot;
  u: number;
  v: number;
  bounds: ScreenBounds;
  pubkey: string;
  wander: boolean;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function useCharacterMovement({
  plot,
  u,
  v,
  bounds,
  pubkey,
  wander,
}: MovementInput): {
  rootRef: React.RefObject<HTMLButtonElement | null>;
  walking: boolean;
} {
  const rootRef = React.useRef<HTMLButtonElement | null>(null);
  const [walking, setWalking] = React.useState(false);
  const worldPosRef = React.useRef<WorldPoint | null>(null);
  const plotRef = React.useRef<IsoPlot | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const wanderTimerRef = React.useRef<number | null>(null);
  const wanderStepRef = React.useRef(0);
  const wanderEnabledRef = React.useRef(wander);
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = React.useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const project = React.useCallback(
    (point: WorldPoint) => {
      const screen = isoToScreen(point.x, point.y);
      return { sx: screen.sx - bounds.minX, sy: screen.sy - bounds.minY };
    },
    [bounds.minX, bounds.minY],
  );

  const applyScreenPosition = React.useCallback((sx: number, sy: number) => {
    const element = rootRef.current;
    if (!element) return;
    element.style.left = `${sx}px`;
    element.style.top = `${sy}px`;
    element.style.zIndex = `${10 + Math.max(0, Math.round(sy))}`;
    element.style.visibility = "visible";
  }, []);

  const stopAnimation = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setWalking(false);
  }, []);

  const clearWanderTimer = React.useCallback(() => {
    if (wanderTimerRef.current !== null) {
      window.clearTimeout(wanderTimerRef.current);
      wanderTimerRef.current = null;
    }
  }, []);

  const scheduleWanderRef = React.useRef<() => void>(() => {});

  const walkTo = React.useCallback(
    (target: WorldPoint, targetPlot: IsoPlot, speedPxPerSecond: number) => {
      stopAnimation();
      const from = worldPosRef.current;
      const previousPlot = plotRef.current;
      plotRef.current = targetPlot;
      const finish = () => {
        worldPosRef.current = target;
        const screen = project(target);
        applyScreenPosition(screen.sx, screen.sy);
        scheduleWanderRef.current();
      };
      if (!from || reducedMotionRef.current) {
        finish();
        return;
      }
      const worldWaypoints = planPath(from, target, previousPlot, targetPlot);
      const screenWaypoints = worldWaypoints.map(project);
      const segmentLengths: number[] = [];
      let total = 0;
      for (let i = 1; i < screenWaypoints.length; i += 1) {
        const length = Math.hypot(
          screenWaypoints[i].sx - screenWaypoints[i - 1].sx,
          screenWaypoints[i].sy - screenWaypoints[i - 1].sy,
        );
        segmentLengths.push(length);
        total += length;
      }
      if (total < SNAP_DISTANCE_PX) {
        finish();
        return;
      }
      const duration = Math.min(
        MAX_WALK_MS,
        Math.max(MIN_WALK_MS, (total / speedPxPerSecond) * 1_000),
      );
      setWalking(true);
      const startedAt = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / duration);
        let remaining = total * t;
        let segment = 0;
        while (
          segment < segmentLengths.length - 1 &&
          remaining > segmentLengths[segment]
        ) {
          remaining -= segmentLengths[segment];
          segment += 1;
        }
        const segLength = segmentLengths[segment];
        const f = segLength === 0 ? 1 : Math.min(1, remaining / segLength);
        const worldA = worldWaypoints[segment];
        const worldB = worldWaypoints[segment + 1];
        worldPosRef.current = {
          x: worldA.x + (worldB.x - worldA.x) * f,
          y: worldA.y + (worldB.y - worldA.y) * f,
        };
        const screenA = screenWaypoints[segment];
        const screenB = screenWaypoints[segment + 1];
        applyScreenPosition(
          screenA.sx + (screenB.sx - screenA.sx) * f,
          screenA.sy + (screenB.sy - screenA.sy) * f,
        );
        if (t >= 1) {
          rafRef.current = null;
          setWalking(false);
          finish();
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [applyScreenPosition, project, stopAnimation],
  );

  const scheduleWander = React.useCallback(() => {
    clearWanderTimer();
    if (!wanderEnabledRef.current || reducedMotionRef.current) return;
    const delay =
      WANDER_MIN_DELAY_MS +
      (hashString(`${pubkey}:${wanderStepRef.current}`) %
        WANDER_DELAY_SPREAD_MS);
    wanderTimerRef.current = window.setTimeout(() => {
      wanderTimerRef.current = null;
      const currentPlot = plotRef.current;
      if (!currentPlot || rafRef.current !== null) return;
      wanderStepRef.current += 1;
      const hash = hashString(`${pubkey}#${wanderStepRef.current}`);
      const wanderU = 0.15 + ((hash & 0xffff) / 0xffff) * 0.7;
      const wanderV = 0.35 + (((hash >>> 16) & 0xffff) / 0xffff) * 0.45;
      walkTo(
        {
          x: currentPlot.x + wanderU * currentPlot.w,
          y: currentPlot.y + wanderV * currentPlot.h,
        },
        currentPlot,
        WANDER_SPEED_PX_S,
      );
    }, delay);
  }, [clearWanderTimer, pubkey, walkTo]);
  scheduleWanderRef.current = scheduleWander;

  // Walk to the assigned spot whenever the projection (or layout) moves it.
  const targetKey = [
    plot.id,
    plot.x,
    plot.y,
    plot.w,
    plot.h,
    u.toFixed(3),
    v.toFixed(3),
    bounds.minX,
    bounds.minY,
  ].join(":");
  // biome-ignore lint/correctness/useExhaustiveDependencies: targetKey encodes every input the walk depends on.
  React.useLayoutEffect(() => {
    const target: WorldPoint = {
      x: plot.x + u * plot.w,
      y: plot.y + v * plot.h,
    };
    if (!worldPosRef.current) {
      plotRef.current = plot;
      worldPosRef.current = target;
      const screen = project(target);
      applyScreenPosition(screen.sx, screen.sy);
      scheduleWanderRef.current();
      return;
    }
    walkTo(target, plot, WALK_SPEED_PX_S);
  }, [targetKey]);

  React.useEffect(() => {
    wanderEnabledRef.current = wander;
    if (!wander) {
      clearWanderTimer();
    } else if (rafRef.current === null && wanderTimerRef.current === null) {
      scheduleWander();
    }
  }, [clearWanderTimer, scheduleWander, wander]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearWanderTimer();
    },
    [clearWanderTimer],
  );

  return { rootRef, walking };
}
