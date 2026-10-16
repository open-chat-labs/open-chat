import { MediaQuery } from "svelte/reactivity";
import { BREAKPOINTS, shellLayout, type Crossed, type ShellLayout } from "./layout";

// One media query per breakpoint, which only reports a change when the viewport crosses it, so the
// layout's readers don't re-run on every resize event. Made on first use, in the browser.
let queries: Record<keyof Crossed, MediaQuery> | undefined;

function breakpoints(): Record<keyof Crossed, MediaQuery> {
    if (queries === undefined) {
        queries = {} as Record<keyof Crossed, MediaQuery>;
        for (const [name, min] of Object.entries(BREAKPOINTS)) {
            queries[name as keyof Crossed] = new MediaQuery(`(min-width: ${min}px)`);
        }
    }
    return queries;
}

// The shell's layout for the current viewport, kept up to date when read in a reactive context
// ($derived, $effect, markup)
export function currentShellLayout(): ShellLayout {
    const q = breakpoints();
    return shellLayout({
        wide: q.wide.current,
        fluidList: q.fluidList.current,
        dockRight: q.dockRight.current,
        pushRail: q.pushRail.current,
        widest: q.widest.current,
    });
}
