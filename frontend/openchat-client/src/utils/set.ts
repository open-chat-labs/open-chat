import type { ReadonlySet } from "openchat-shared";

export function setsAreEqual(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
    if (a === b) return true;
    if (a.size !== b.size) return false;

    for (const key of a) {
        if (!b.has(key)) return false;
    }
    return true;
}

export function setsEqualIfEmpty(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
    return a === b || (a.size === 0 && b.size === 0);
}
