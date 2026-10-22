// The shell's breakpoints that change its markup (architecture §3, from the prototype: keep them
// exact): one column, a docked or a modal right column, a pushing or a floating rail. They're on the
// shell's own width, as its CSS container queries are (Fix Brief - App Shell Layout), so what the
// code decides and what CSS shows agree. The widths themselves (the chat list's, the right
// column's steps, the island's minimum) are in Shell's container queries.
// Each is a minimum width: the shell is past it from that many pixels.
export const BREAKPOINTS = {
    // below this the app is one column at a time (list or conversation)
    wide: 768,
    // the right column docks; below it, it opens as a modal
    dockRight: 1476,
    // the nav rail pushes the layout when expanded; below it, it floats over it
    pushRail: 1876,
} as const;

export type Crossed = Record<keyof typeof BREAKPOINTS, boolean>;

export type ShellLayout = {
    narrow: boolean;
    rail: "push" | "float";
    right: "dock" | "modal";
};

export function crossedAt(width: number): Crossed {
    const crossed = {} as Crossed;
    for (const [name, min] of Object.entries(BREAKPOINTS)) {
        crossed[name as keyof Crossed] = width >= min;
    }
    return crossed;
}

export function shellLayout(crossed: Crossed): ShellLayout {
    return {
        narrow: !crossed.wide,
        rail: crossed.pushRail ? "push" : "float",
        right: crossed.dockRight ? "dock" : "modal",
    };
}

/** The one column a narrow viewport shows, if it's narrow: the middle when there's no left one. */
export function narrowColumn(
    layout: ShellLayout,
    hasLeft: boolean,
    view: "left" | "middle",
): "left" | "middle" | undefined {
    if (!layout.narrow) return undefined;
    return hasLeft ? view : "middle";
}
