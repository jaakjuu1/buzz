import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 4;

type Camera = { x: number; y: number; scale: number };

type WorldCanvasProps = {
  stageWidth: number;
  stageHeight: number;
  children: React.ReactNode;
};

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Pan/zoom camera over the isometric stage: drag to pan, wheel or the
 * corner buttons to zoom, fit-to-view on mount and via the fit button.
 * Purely presentational — knows nothing about rooms or characters.
 */
export function WorldCanvas({
  stageWidth,
  stageHeight,
  children,
}: WorldCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = React.useState<Camera | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
    moved: boolean;
  } | null>(null);

  const fitCamera = React.useCallback((): Camera | null => {
    const container = containerRef.current;
    if (!container || stageWidth <= 0 || stageHeight <= 0) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scale = clampScale(
      Math.min(rect.width / stageWidth, rect.height / stageHeight, 1.1),
    );
    return {
      x: (rect.width - stageWidth * scale) / 2,
      y: (rect.height - stageHeight * scale) / 2,
      scale,
    };
  }, [stageHeight, stageWidth]);

  const interactedRef = React.useRef(false);

  React.useLayoutEffect(() => {
    // Refit when the stage size changes (rooms loading in) until the user
    // frames the world themselves; after that the camera is theirs.
    if (!interactedRef.current) {
      setCamera(fitCamera());
    }
  }, [fitCamera]);

  const handleFit = React.useCallback(() => {
    interactedRef.current = false;
    setCamera(fitCamera());
  }, [fitCamera]);

  const zoomBy = React.useCallback(
    (factor: number, cx?: number, cy?: number) => {
      interactedRef.current = true;
      setCamera((current) => {
        if (!current) return current;
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        const originX = cx ?? (rect ? rect.width / 2 : 0);
        const originY = cy ?? (rect ? rect.height / 2 : 0);
        const scale = clampScale(current.scale * factor);
        const ratio = scale / current.scale;
        return {
          scale,
          x: originX - (originX - current.x) * ratio,
          y: originY - (originY - current.y) * ratio,
        };
      });
    },
    [],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      zoomBy(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !camera) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cameraX: camera.x,
        cameraY: camera.y,
        moved: false,
      };
    },
    [camera],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      if (!drag.moved) {
        drag.moved = true;
        interactedRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setCamera((current) =>
        current
          ? { ...current, x: drag.cameraX + dx, y: drag.cameraY + dy }
          : current,
      );
    },
    [],
  );

  const handlePointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;
      // Keep the drag record until click-capture has a chance to suppress
      // the synthetic click that follows a pan gesture.
      requestAnimationFrame(() => {
        dragRef.current = null;
      });
    },
    [],
  );

  const handleClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (dragRef.current?.moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [],
  );

  return (
    <div
      className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      data-testid="world-canvas"
      onClickCapture={handleClickCapture}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={containerRef}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: camera
            ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`
            : undefined,
          transformOrigin: "0 0",
          visibility: camera ? "visible" : "hidden",
        }}
      >
        {/* Ground: subtle dot grid that pans and zooms with the world. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--border) / 0.55) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {children}
      </div>
      <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1">
        <Button
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
          size="icon"
          variant="secondary"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Zoom out"
          onClick={() => zoomBy(0.8)}
          size="icon"
          variant="secondary"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Fit world to view"
          onClick={handleFit}
          size="icon"
          variant="secondary"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
