export const OVERSCAN_PX = 1200;

export function getHeight(heightMap: number[], averageHeight: number, i: number): number {
    const h = heightMap[i];
    return h > 0 ? h : averageHeight;
}

// ── Prefix sums ────────────────────────────────────────────────────────
// prefix[i] = sum of heights for items 0..i-1 (pure heights, no gap).
// Position with gap: startPos(i) = prefix[i] + i * gap.
// endPos(i) = prefix[i+1] + i * gap.
// Both are monotonically increasing, enabling binary search.
export function buildPrefixSums(
    itemCount: number,
    heightMap: number[],
    averageHeight: number,
): number[] {
    const prefix = new Array<number>(itemCount + 1);
    prefix[0] = 0;
    for (let i = 0; i < itemCount; i++) {
        prefix[i + 1] = prefix[i] + getHeight(heightMap, averageHeight, i);
    }
    return prefix;
}

// Binary search: find first index in [lo, hi) where predicate is true.
// Predicate must be monotonic (false, false, ..., true, true, ...).
function lowerBound(lo: number, hi: number, pred: (i: number) => boolean): number {
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pred(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

/**
 * Compute the [start, end) indices of the virtual window to render.
 *
 * Uses binary search on the prefix sum array for O(log N) per scroll event.
 *
 * Items are laid out bottom-to-top (column-reverse). fromBottom is the scroll
 * distance from the visual bottom (newest items). The window includes all items
 * whose extent overlaps [fromBottom - overscan, fromBottom + viewportHeight + overscan].
 *
 * `gap` is the CSS flex gap (px) between items. Including it in cumulative
 * positions ensures window boundaries align with actual scroll distances.
 */
export function computeWindow(
    itemCount: number,
    prefix: number[],
    fromBottom: number,
    viewportHeight: number,
    overscan: number = OVERSCAN_PX,
    gap: number = 0,
): [number, number] {
    const N = itemCount;
    if (N === 0) return [0, 0];

    const lowThresh = Math.max(0, fromBottom - overscan);
    const highThresh = fromBottom + viewportHeight + overscan;

    // Find first item whose bottom edge (endPos) exceeds lowThresh.
    // endPos(i) = prefix[i+1] + i * gap
    const s = lowerBound(0, N, (i) => prefix[i + 1] + i * gap > lowThresh);

    // Find first item whose top edge (startPos) exceeds highThresh.
    // startPos(i) = prefix[i] + i * gap
    const e = lowerBound(s, N, (i) => prefix[i] + i * gap > highThresh);

    return [s, Math.min(N, e)];
}

/**
 * Compute [bottomSpacerHeight, topSpacerHeight] for a given [start, end) window.
 * Uses prefix sums for O(1) range queries.
 *
 * Bottom spacer covers items[0..start) (newer items below the window).
 * Top spacer covers items[end..N) (older items above the window).
 *
 * Each spacer includes the inter-item gaps that would exist between the items
 * it represents. For K items, that's max(0, K-1) gaps. The gap between the
 * spacer div and the first rendered item is provided by the CSS flex gap.
 */
export function computeSpacers(
    itemCount: number,
    prefix: number[],
    s: number,
    e: number,
    gap: number = 0,
): [number, number] {
    let bh = prefix[s];
    if (s > 1) bh += (s - 1) * gap;
    let th = prefix[itemCount] - prefix[e];
    const topCount = itemCount - e;
    if (topCount > 1) th += (topCount - 1) * gap;
    return [bh, th];
}
