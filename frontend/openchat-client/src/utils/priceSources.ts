import type { PriceSource, ReadonlyMap } from "@shared";

/**
 * Where prices from the given sources come from, each once: what a price card names, whether or not
 * the source asks to be credited. A source the service hasn't described is left out.
 */
export function priceSourcesFor(
    sources: ReadonlyMap<string, PriceSource>,
    sourceIds: (string | undefined)[],
): PriceSource[] {
    const found: PriceSource[] = [];
    for (const id of new Set(sourceIds)) {
        const source = id !== undefined ? sources.get(id) : undefined;
        if (source !== undefined) found.push(source);
    }
    return found;
}

/**
 * Of those, the sources that must be credited wherever their prices are shown, as a cashtag chip's
 * tooltip.
 */
export function priceCredits(
    sources: ReadonlyMap<string, PriceSource>,
    sourceIds: (string | undefined)[],
): PriceSource[] {
    return priceSourcesFor(sources, sourceIds).filter((s) => s.attributionRequired);
}
