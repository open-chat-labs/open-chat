import type { ReadonlySet } from "openchat-shared";

export function setsAreEqual(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
    if (a.size !== b.size) {
        return false;
    }

    return Array.from(a).every((element) => {
        return b.has(element);
    });
}
