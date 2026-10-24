// Geometry helpers shared by the game boards. Everything is drawn in an SVG whose user units
// are CELL per grid cell, so a board at any pixel size scales without recomputing.
import type { GameElement } from "@client";

export const CELL = 10;
/** Thickness of an edge element's rect, in SVG units. */
export const EDGE = 2.4;

export type Rect = { x: number; y: number; width: number; height: number };

/** The rect for an element. Cells fill their square; edges become thin rects centred on the boundary. */
export function elementRect(el: GameElement): Rect {
    if (el.kind === "edge") {
        const horizontal = el.w >= el.h;
        return horizontal
            ? { x: el.x * CELL, y: el.y * CELL - EDGE / 2, width: el.w * CELL, height: EDGE }
            : { x: el.x * CELL - EDGE / 2, y: el.y * CELL, width: EDGE, height: el.h * CELL };
    }
    return { x: el.x * CELL, y: el.y * CELL, width: el.w * CELL, height: el.h * CELL };
}

/** Centre of an element, for marks and labels. */
export function elementCentre(el: GameElement): { cx: number; cy: number } {
    return { cx: (el.x + el.w / 2) * CELL, cy: (el.y + el.h / 2) * CELL };
}

/** Corner (vertex) at column vx, row vy, both 0..=width / 0..=height. For vertex clues. */
export function vertex(vx: number, vy: number): { cx: number; cy: number } {
    return { cx: vx * CELL, cy: vy * CELL };
}

/**
 * Position for a count drawn outside the grid: `side` names the edge of the grid it sits
 * beside, `index` the row or column it belongs to. Boards that use these must reserve the
 * margin via GridSvg's `margin` prop.
 */
export function outside(
    side: "top" | "bottom" | "left" | "right",
    index: number,
    width: number,
    height: number,
): { cx: number; cy: number } {
    const mid = (index + 0.5) * CELL;
    switch (side) {
        case "top":
            return { cx: mid, cy: -CELL / 2 };
        case "bottom":
            return { cx: mid, cy: height * CELL + CELL / 2 };
        case "left":
            return { cx: -CELL / 2, cy: mid };
        case "right":
            return { cx: width * CELL + CELL / 2, cy: mid };
    }
}

/** Keys covered by violations of the given kinds. */
export function keysOf(
    violations: { keys: number[]; kind: string }[],
    ...kinds: string[]
): Set<number> {
    const out = new Set<number>();
    for (const v of violations) {
        if (kinds.includes(v.kind)) v.keys.forEach((k) => out.add(k));
    }
    return out;
}

/**
 * How a hint highlight is drawn. A hint's `target` keys are the ones its sentence points at
 * ("this cell", "this number"); the rest of `focus` is the context the deduction looked at and
 * is drawn faintly so the sentence has one obvious subject.
 */
export function highlight(
    key: number,
    focus: Set<number>,
    target: Set<number>,
): { on: boolean; fill: string; stroke: string } {
    if (target.has(key)) {
        return { on: true, fill: "rgba(59,130,246,0.28)", stroke: "#3b82f6" };
    }
    if (focus.has(key)) {
        return { on: true, fill: "rgba(59,130,246,0.1)", stroke: "rgba(59,130,246,0.35)" };
    }
    return { on: false, fill: "none", stroke: "none" };
}

/**
 * The tap polygon for one part of a cell, in SVG units: the whole cell, or one of the four
 * quarters its diagonals cut it into, each with its apex at the centre. The four quarters
 * partition the cell, so two edges sharing a cell (Bridges, #9372) can each own a pair without
 * overlap: left and right for the horizontal edge, top and bottom for the vertical.
 */
export function hitQuarter(
    origin: { x: number; y: number },
    part: "whole" | "left" | "right" | "top" | "bottom",
): [number, number][] {
    const x0 = origin.x;
    const y0 = origin.y;
    const x1 = origin.x + CELL;
    const y1 = origin.y + CELL;
    const cx = origin.x + CELL / 2;
    const cy = origin.y + CELL / 2;
    switch (part) {
        case "whole":
            return [
                [x0, y0],
                [x1, y0],
                [x1, y1],
                [x0, y1],
            ];
        case "left":
            return [
                [x0, y0],
                [cx, cy],
                [x0, y1],
            ];
        case "right":
            return [
                [x1, y0],
                [cx, cy],
                [x1, y1],
            ];
        case "top":
            return [
                [x0, y0],
                [x1, y0],
                [cx, cy],
            ];
        case "bottom":
            return [
                [x0, y1],
                [x1, y1],
                [cx, cy],
            ];
    }
}
