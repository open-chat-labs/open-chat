import type { ReadonlyMap } from "openchat-shared";

export function mapsEqualIfEmpty<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
    return a === b || (a.size === 0 && b.size === 0);
}
