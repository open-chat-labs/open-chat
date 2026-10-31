import type { PriceSource, PriceSubject, ReadonlyMap } from "@shared";

/**
 * Where prices from the given sources come from, each once: what a price card and a cashtag chip's
 * tooltip credit. A source the service hasn't described is left out.
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

/** What a credit for one token's or coin's prices links to: its page at the source, if there's one. */
export function priceSourceUrl(source: PriceSource, subject: PriceSubject): string {
    if (source.tokenUrl === undefined) return source.url;
    const id = subject.kind === "token" ? subject.ledger : subject.id;
    return source.tokenUrl.replace("{id}", encodeURIComponent(id));
}
