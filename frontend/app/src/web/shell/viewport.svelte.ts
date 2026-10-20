import { crossedAt, shellLayout, type Crossed, type ShellLayout } from "./layout";

// The shell's layout, from the shell's own width: its content box, the width its CSS container
// queries see (Fix Brief - App Shell Layout), so the code and the CSS change at the same place.
// Shell reports it (setShellWidth) as it resizes; before a shell has, the window's width less the
// shell's padding stands in.
const SHELL_PADDING = 24;

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

// The shell's layout for its current width, kept up to date when read in a reactive context
// ($derived, $effect, markup)
export function currentShellLayout(): ShellLayout {
    if (crossed !== undefined) return shellLayout(crossed);
    const width = typeof window === "undefined" ? 0 : window.innerWidth - SHELL_PADDING;
    return shellLayout(crossedAt(width));
}
