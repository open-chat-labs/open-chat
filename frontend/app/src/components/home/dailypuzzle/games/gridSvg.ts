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
