import classNames from "classnames";
import { useAtomValue } from "jotai";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";
import { useLocalStorage } from "react-use";
import { activeWorkspaceAtom } from "../../hooks/useActiveWorkspace";
import { useContainerSize } from "../../hooks/useContainerQuery";
import { clamp } from "../../lib/clamp";
import type { ResizeHandleEvent } from "../ResizeHandle";
import { ResizeHandle } from "../ResizeHandle";

export type SplitLayoutLayout = "responsive" | "horizontal" | "vertical";

export interface SlotProps {
  orientation: "horizontal" | "vertical";
  style: CSSProperties;
}

interface Props {
  name: string;
  firstSlot: (props: SlotProps) => ReactNode;
  secondSlot: null | ((props: SlotProps) => ReactNode);
  style?: CSSProperties;
  className?: string;
  defaultRatio?: number;
  minHeightPx?: number;
  minWidthPx?: number;
  layout?: SplitLayoutLayout;
  resizeHandleClassName?: string;
}

const baseProperties = { minWidth: 0 };
const areaL = { ...baseProperties, gridArea: "left" };
const areaR = { ...baseProperties, gridArea: "right" };
const areaD = { ...baseProperties, gridArea: "drag" };

const STACK_VERTICAL_WIDTH = 500;

export function SplitLayout({
  style,
  firstSlot,
  secondSlot,
  className,
  name,
  layout = "responsive",
  resizeHandleClassName,
  defaultRatio = 0.5,
  minHeightPx = 10,
  minWidthPx = 10,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWorkspace = useAtomValue(activeWorkspaceAtom);
  const [storedWidth, setWidth] = useLocalStorage<number>(
    `${name}_width::${activeWorkspace?.id ?? "n/a"}`,
  );
  const [storedHeight, setHeight] = useLocalStorage<number>(
    `${name}_height::${activeWorkspace?.id ?? "n/a"}`,
  );

  const rawWidth = storedWidth ?? defaultRatio;
  const rawHeight = secondSlot ? (storedHeight ?? defaultRatio) : 0;
  const effectiveMinHeightPx = secondSlot ? minHeightPx : 0;

  const size = useContainerSize(containerRef);
  const verticalBasedOnSize = size.width !== 0 && size.width < STACK_VERTICAL_WIDTH;
  const vertical = layout !== "horizontal" && (layout === "vertical" || verticalBasedOnSize);

  const heightMinRatio =
    vertical && size.height > 0 ? Math.min(effectiveMinHeightPx / size.height, 0.5) : 0;
  const widthMinRatio =
    !vertical && size.width > 0 ? Math.min(minWidthPx / size.width, 0.5) : 0;

  const height = vertical ? clamp(rawHeight, heightMinRatio, 1 - heightMinRatio) : rawHeight;
  const width = !vertical ? clamp(rawWidth, widthMinRatio, 1 - widthMinRatio) : rawWidth;

  const styles = useMemo<CSSProperties>(() => {
    return {
      ...style,
      gridTemplate: vertical
        ? `
            ' ${areaL.gridArea}' minmax(0,${1 - height}fr)
            ' ${areaD.gridArea}' 0
            ' ${areaR.gridArea}' minmax(${effectiveMinHeightPx}px,${height}fr)
            / 1fr
          `
        : `
            ' ${areaL.gridArea} ${areaD.gridArea} ${areaR.gridArea}' minmax(0,1fr)
            / ${1 - width}fr    0                 ${width}fr
          `,
    };
  }, [style, vertical, height, effectiveMinHeightPx, width]);

  const handleReset = useCallback(() => {
    if (vertical) setHeight(defaultRatio);
    else setWidth(defaultRatio);
  }, [vertical, setHeight, defaultRatio, setWidth]);

  const handleResizeMove = useCallback(
    (e: ResizeHandleEvent) => {
      if (containerRef.current === null) return;

      const { paddingLeft, paddingRight, paddingTop, paddingBottom } = getComputedStyle(
        containerRef.current,
      );
      const $c = containerRef.current;
      const containerWidth =
        $c.clientWidth - Number.parseFloat(paddingLeft) - Number.parseFloat(paddingRight);
      const containerHeight =
        $c.clientHeight - Number.parseFloat(paddingTop) - Number.parseFloat(paddingBottom);

      if (containerWidth <= 0 || containerHeight <= 0) return;

      if (vertical) {
        const minRatio = Math.min(effectiveMinHeightPx / containerHeight, 0.5);
        const startHeight = containerHeight * clamp(rawHeight, minRatio, 1 - minRatio);
        const maxHeightPx = Math.max(effectiveMinHeightPx, containerHeight - effectiveMinHeightPx);
        const newHeightPx = clamp(startHeight - (e.y - e.yStart), effectiveMinHeightPx, maxHeightPx);
        setHeight(newHeightPx / containerHeight);
      } else {
        const minRatio = Math.min(minWidthPx / containerWidth, 0.5);
        const startWidth = containerWidth * clamp(rawWidth, minRatio, 1 - minRatio);
        const maxWidthPx = Math.max(minWidthPx, containerWidth - minWidthPx);
        const newWidthPx = clamp(startWidth - (e.x - e.xStart), minWidthPx, maxWidthPx);
        setWidth(newWidthPx / containerWidth);
      }
    },
    [rawWidth, rawHeight, vertical, effectiveMinHeightPx, setHeight, minWidthPx, setWidth],
  );

  return (
    <div
      ref={containerRef}
      style={styles}
      className={classNames(className, "grid w-full h-full overflow-hidden")}
    >
      {firstSlot({ style: areaL, orientation: vertical ? "vertical" : "horizontal" })}
      {secondSlot && (
        <>
          <ResizeHandle
            style={areaD}
            className={classNames(
              resizeHandleClassName,
              vertical ? "-translate-y-1" : "-translate-x-1",
            )}
            onResizeMove={handleResizeMove}
            onReset={handleReset}
            side={vertical ? "top" : "left"}
            justify="center"
          />
          {secondSlot({ style: areaR, orientation: vertical ? "vertical" : "horizontal" })}
        </>
      )}
    </div>
  );
}
