import { flushSync } from "svelte";

// jsdom has no matchMedia. This one answers the shell's (min-width: Npx) queries from innerWidth
// and fires "change" only when a resize crosses the width, as browsers do. Reduced motion matches
// when asked for; any other query doesn't match.
export function installMatchMedia({ reducedMotion = false } = {}): void {
    window.matchMedia = (query: string) => {
        const list = new EventTarget();
        const width = /min-width:\s*(\d+)px/.exec(query);
        if (width === null) {
            const matches = reducedMotion && query.includes("prefers-reduced-motion: reduce");
            Object.defineProperty(list, "matches", { value: matches });
            return list as MediaQueryList;
        }
        const min = Number(width[1]);
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
