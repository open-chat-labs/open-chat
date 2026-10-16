import { flushSync } from "svelte";

// jsdom has no matchMedia. This one answers the shell's (min-width: Npx) queries from innerWidth
// and fires "change" only when a resize crosses the width, as browsers do.
export function installMatchMedia(): void {
    window.matchMedia = (query: string) => {
        const min = Number(/min-width:\s*(\d+)px/.exec(query)![1]);
        const list = new EventTarget();
        let matched = window.innerWidth >= min;
        window.addEventListener("resize", () => {
            if (window.innerWidth >= min !== matched) {
                matched = !matched;
                list.dispatchEvent(new Event("change"));
            }
        });
        Object.defineProperty(list, "matches", { get: () => window.innerWidth >= min });
        return list as MediaQueryList;
    };
}

export function setViewportWidth(width: number): void {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    window.dispatchEvent(new Event("resize"));
    flushSync();
}
