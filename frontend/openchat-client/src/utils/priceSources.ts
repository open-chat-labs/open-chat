import type { PriceSource, ReadonlyMap } from "@shared";

/**
 * The sources to credit where prices from the given sources are shown: those that require it, each
 * once. A source the service hasn't described can't be credited, and is left out.
 */
export function priceCredits(
    sources: ReadonlyMap<string, PriceSource>,
    sourceIds: (string | undefined)[],
): PriceSource[] {
    const credits: PriceSource[] = [];
    for (const id of new Set(sourceIds)) {
        const source = id !== undefined ? sources.get(id) : undefined;
        if (source?.attributionRequired) credits.push(source);
    }
    return credits;
}
