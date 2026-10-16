// The shell's breakpoints (architecture brief §3, from the prototype: keep them exact). They are
// read in script rather than in media queries so that the numbers live in one place, and so the
// right column can switch between a docked column and a modal, which are different markup.

// Below this the app is one column at a time (list or conversation)
export const NARROW_MAX = 768;
// From here the chat list is 30% of the app's width (clamped 350–550px) rather than 350px
export const FLUID_LIST_MIN = 1200;
// From here the right column docks; below it, it opens as a modal
export const DOCK_RIGHT_MIN = 1476;
// From here the nav rail pushes the layout when expanded; below it, it floats over it
export const PUSH_RAIL_MIN = 1876;

// The docked right column is 375 / 425 / 500px "as width grows". The brief doesn't say where it
// grows, so these steps are ours (GAPS.md): 425 once the rail pushes, 500 from the library's
// widest breakpoint (--bp-3xl).
const RIGHT_WIDTHS: [minWidth: number, width: number][] = [
    [2500, 500],
    [PUSH_RAIL_MIN, 425],
    [DOCK_RIGHT_MIN, 375],
];
// The modal right column, below DOCK_RIGHT_MIN
const RIGHT_MODAL_WIDTH = 375;

export type ShellLayout = {
    narrow: boolean;
    rail: "push" | "float";
    list: "fluid" | "fixed";
    right: "dock" | "modal";
    rightWidth: number;
};

export function shellLayout(width: number): ShellLayout {
    const right = width >= DOCK_RIGHT_MIN ? "dock" : "modal";
    return {
        narrow: width < NARROW_MAX,
        rail: width >= PUSH_RAIL_MIN ? "push" : "float",
        list: width >= FLUID_LIST_MIN ? "fluid" : "fixed",
        right,
        rightWidth:
            right === "dock"
                ? (RIGHT_WIDTHS.find(([min]) => width >= min)?.[1] ?? RIGHT_MODAL_WIDTH)
                : RIGHT_MODAL_WIDTH,
    };
}
