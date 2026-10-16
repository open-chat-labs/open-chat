import { createSubscriber } from "svelte/reactivity";
import { shellLayout, type ShellLayout } from "./layout";

const subscribe = createSubscriber((update) => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
});

// The shell's layout for the current viewport, kept up to date as the window resizes when read in
// a reactive context ($derived, $effect, markup)
export function currentShellLayout(): ShellLayout {
    subscribe();
    return shellLayout(window.innerWidth);
}
