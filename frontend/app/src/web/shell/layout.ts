// The shell's breakpoints (architecture brief §3, from the prototype: keep them exact). They are
// read in script rather than in media queries in CSS so that the numbers live in one place, and so
// the right column can switch between a docked column and a modal, which are different markup.
// Each is a minimum width: the viewport is past it from that many pixels.
export const BREAKPOINTS = {
    // below this the app is one column at a time (list or conversation)
    wide: 768,
    // the chat list is 30% of the app's width (clamped 350–550px) rather than 350px
    fluidList: 1200,
    // the right column docks; below it, it opens as a modal
    dockRight: 1476,
    // the nav rail pushes the layout when expanded; below it, it floats over it
    pushRail: 1876,
    // the library's widest breakpoint (--bp-3xl), where the docked right column is widest
    widest: 2500,
} as const;

export type Crossed = Record<keyof typeof BREAKPOINTS, boolean>;

export type ShellLayout = {
    narrow: boolean;
    rail: "push" | "float";
    list: "fluid" | "fixed";
    right: "dock" | "modal";
    rightWidth: number;
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
        list: crossed.fluidList ? "fluid" : "fixed",
        right: crossed.dockRight ? "dock" : "modal",
        // 375 / 425 / 500px "as width grows" (the modal is 375px). The brief doesn't say where it
        // grows, so these steps are ours (GAPS.md).
        rightWidth: crossed.widest ? 500 : crossed.pushRail ? 425 : 375,
    };
}
