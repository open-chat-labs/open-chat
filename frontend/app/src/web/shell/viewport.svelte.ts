import { crossedAt, shellLayout, type Crossed, type ShellLayout } from "./layout";

// The shell's layout, from the shell's own width: its content box, the width its CSS container
// queries see (Fix Brief - App Shell Layout), so the code and the CSS change at the same place.
// Shell reports it (setShellWidth) as it resizes; before a shell has, the page's width (without
// a scrollbar, as the shell's), at least the shell's minimum, less the shell's padding stands in.
// Both as Shell's CSS has them: 2 × 12px padding, and a minimum of the island's 825px, the rail's
// 60px and the 10px gap between them, plus the padding.
const SHELL_PADDING = 24;
const SHELL_MIN_WIDTH = 919;

// changed only when the width crosses a breakpoint, so the layout's readers don't re-run on every
// resize
let crossed = $state<Crossed | undefined>(undefined);

function same(a: Crossed, b: Crossed): boolean {
    return (Object.keys(a) as (keyof Crossed)[]).every((name) => a[name] === b[name]);
}

/** The shell's content width, as it resizes (Shell). */
export function setShellWidth(width: number): void {
    const next = crossedAt(width);
    if (crossed === undefined || !same(crossed, next)) crossed = next;
}

/** Forgets the reported width when the shell goes, so the next one starts from the page's. */
export function clearShellWidth(): void {
    crossed = undefined;
}

// The shell's layout for its current width, kept up to date when read in a reactive context
// ($derived, $effect, markup)
export function currentShellLayout(): ShellLayout {
    if (crossed !== undefined) return shellLayout(crossed);
    const page = typeof document === "undefined" ? 0 : document.documentElement.clientWidth;
    const width = Math.max(page, SHELL_MIN_WIDTH) - SHELL_PADDING;
    return shellLayout(crossedAt(width));
}
