// Line-by-line TypeScript port of the user_canister backend's `build_swap_plan`
// at backend/canisters/user/impl/src/token_swaps/taco.rs:391-568. The frontend
// quote runs this same optimizer over TACO's BatchMulti response so the
// displayed amount matches what the backend will deliver at execution time.
//
// All amounts are bigint (JS arbitrary-precision); Rust's u128 saturating_mul
// is unnecessary because bigint doesn't overflow. The fixed-bp tuple lists are
// pre-enumerated combinations that sum to 10000 (basis points of the swap
// input), keeping the search to ~810 worst-case iterations vs the
// C(50,2)+C(50,3) ≈ 21k it would otherwise be.

import type { ApiBatchMultiResponse, ApiQuoteRoute } from "./candid/idl";

export const NUM_FRACTIONS = 10;
export const STEP_BP = 1000n;
export const TOP_ROUTES_PER_FRACTION = 5n;
export const MAX_LEGS = 3;
const SPLIT_IMPROVEMENT_NUMERATOR = 1001n;
const SPLIT_IMPROVEMENT_DENOMINATOR = 1000n;

// (a <= b), a + b = 10000
const TWO_LEG_BP_PAIRS: ReadonlyArray<readonly [bigint, bigint]> = [
    [1000n, 9000n],
    [2000n, 8000n],
    [3000n, 7000n],
    [4000n, 6000n],
    [5000n, 5000n],
];

// (a <= b <= c), a + b + c = 10000
const THREE_LEG_BP_TRIPLES: ReadonlyArray<readonly [bigint, bigint, bigint]> = [
    [1000n, 1000n, 8000n],
    [1000n, 2000n, 7000n],
    [1000n, 3000n, 6000n],
    [1000n, 4000n, 5000n],
    [2000n, 2000n, 6000n],
    [2000n, 3000n, 5000n],
    [2000n, 4000n, 4000n],
    [3000n, 3000n, 4000n],
];

export type SwapHop = { tokenIn: string; tokenOut: string };

export type QuoteEntry = {
    bp: bigint;
    route: SwapHop[];
    expectedOut: bigint;
    routeKey: string;
    edgeKeys: string[];
};

export type SwapPlan =
    | { kind: "single"; expectedOut: bigint }
    | { kind: "multi"; expectedOut: bigint }
    | { kind: "none"; expectedOut: bigint };

// Normalize a pool edge so (A,B) and (B,A) hash to the same key.
function normalizeEdge(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Two leg edge-sets overlap iff they share any normalized edge.
function edgesOverlap(a: string[], b: string[]): boolean {
    for (const ea of a) {
        for (const eb of b) {
            if (ea === eb) return true;
        }
    }
    return false;
}

// Materialize hops for a quote entry. For direct (1-hop) routes the canister
// returns hopDetails = [] AND routeTokens = [tokenSell, tokenBuy]; synthesize a
// single hop in that case so the optimizer can still compute an edge key.
export function hopsFromRoute(route: ApiQuoteRoute): SwapHop[] {
    if (route.hopDetails.length > 0) {
        return route.hopDetails.map((h) => ({
            tokenIn: h.tokenIn,
            tokenOut: h.tokenOut,
        }));
    }
    if (route.routeTokens.length === 2) {
        return [{ tokenIn: route.routeTokens[0], tokenOut: route.routeTokens[1] }];
    }
    return [];
}

// Flatten BatchMulti into entries (one per (fraction, route)). Dedupes by
// (bp, routeKey) so each fraction sees each route at most once. `bps` must
// contain the actual basis-points for each submitted probe, in the same order
// as the batch request — otherwise dropped zero-amount probes would shift the
// index and mislabel responses (same bug Copilot caught in the backend).
export function flattenBatch(batch: ApiBatchMultiResponse, bps: bigint[]): QuoteEntry[] {
    const out: QuoteEntry[] = [];
    const seen = new Set<string>();
    const n = Math.min(batch.length, bps.length);
    for (let i = 0; i < n; i++) {
        const req = batch[i];
        const bp = bps[i];
        for (const route of req.routes) {
            const expected = route.expectedBuyAmount;
            if (expected === 0n) continue;
            const hops = hopsFromRoute(route);
            if (hops.length === 0) continue;
            const routeKey = route.routeTokens.join("→");
            const dedupKey = `${bp}|${routeKey}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            const edgeKeys = hops.map((h) => normalizeEdge(h.tokenIn, h.tokenOut));
            out.push({ bp, route: hops, expectedOut: expected, routeKey, edgeKeys });
        }
    }
    return out;
}

function pairCompatible(a: QuoteEntry, b: QuoteEntry): boolean {
    return a.routeKey !== b.routeKey && !edgesOverlap(a.edgeKeys, b.edgeKeys);
}

// Route × fraction optimizer. Returns the best total expected_out across all
// considered plans (single OR 2-leg OR 3-leg). Mirrors the Rust version exactly.
export function buildSwapPlan(
    batch: ApiBatchMultiResponse,
    probeBps: bigint[],
): SwapPlan {
    const entries = flattenBatch(batch, probeBps);
    if (entries.length === 0) {
        return { kind: "none", expectedOut: 0n };
    }

    // Group entries by their bp, then sort each group by expectedOut desc.
    const byBp = new Map<bigint, number[]>();
    for (let idx = 0; idx < entries.length; idx++) {
        const e = entries[idx];
        const arr = byBp.get(e.bp);
        if (arr) arr.push(idx);
        else byBp.set(e.bp, [idx]);
    }
    for (const indices of byBp.values()) {
        indices.sort((a, b) => {
            const da = entries[a].expectedOut;
            const db = entries[b].expectedOut;
            if (db > da) return 1;
            if (db < da) return -1;
            return 0;
        });
    }

    const empty: number[] = [];
    const group = (bp: bigint): number[] => byBp.get(bp) ?? empty;
    const groupTopOut = (bp: bigint): bigint => {
        const g = group(bp);
        return g.length > 0 ? entries[g[0]].expectedOut : 0n;
    };

    // Baseline: top route at 100% — after sorting it's the first entry in the
    // 10000-bp group (if any).
    const baselineGroup = group(10000n);
    const baselineIdx = baselineGroup.length > 0 ? baselineGroup[0] : -1;
    const baselineOut = baselineIdx >= 0 ? entries[baselineIdx].expectedOut : 0n;

    // Pre-seed best_total to the 0.1% threshold so any combo that displaces it
    // is by definition ≥ 0.1% better than baseline.
    let bestTotal: bigint =
        (baselineOut * SPLIT_IMPROVEMENT_NUMERATOR) / SPLIT_IMPROVEMENT_DENOMINATOR;
    let bestPlan: number[] | null = null;

    // ── 2-leg search ────────────────────────────────────────────────────────
    for (const [bpA, bpB] of TWO_LEG_BP_PAIRS) {
        // Tuple upper-bound prune.
        if (groupTopOut(bpA) + groupTopOut(bpB) <= bestTotal) continue;

        const groupA = group(bpA);
        if (bpA === bpB) {
            for (let xi = 0; xi < groupA.length; xi++) {
                const i = groupA[xi];
                const aOut = entries[i].expectedOut;
                const nextOut =
                    xi + 1 < groupA.length ? entries[groupA[xi + 1]].expectedOut : 0n;
                if (aOut + nextOut <= bestTotal) break;
                for (let xj = xi + 1; xj < groupA.length; xj++) {
                    const j = groupA[xj];
                    const total = aOut + entries[j].expectedOut;
                    if (total <= bestTotal) break;
                    if (pairCompatible(entries[i], entries[j])) {
                        bestTotal = total;
                        bestPlan = [i, j];
                    }
                }
            }
        } else {
            const groupB = group(bpB);
            const maxBOut = groupB.length > 0 ? entries[groupB[0]].expectedOut : 0n;
            for (const i of groupA) {
                const aOut = entries[i].expectedOut;
                if (aOut + maxBOut <= bestTotal) break;
                for (const j of groupB) {
                    const total = aOut + entries[j].expectedOut;
                    if (total <= bestTotal) break;
                    if (pairCompatible(entries[i], entries[j])) {
                        bestTotal = total;
                        bestPlan = [i, j];
                    }
                }
            }
        }
    }

    // ── 3-leg search ────────────────────────────────────────────────────────
    if (MAX_LEGS >= 3) {
        for (const [bpA, bpB, bpC] of THREE_LEG_BP_TRIPLES) {
            if (groupTopOut(bpA) + groupTopOut(bpB) + groupTopOut(bpC) <= bestTotal) continue;

            const groupA = group(bpA);
            const groupB = group(bpB);
            const groupC = group(bpC);
            const sameAB = bpA === bpB;
            const sameBC = bpB === bpC;
            const maxCOut = groupC.length > 0 ? entries[groupC[0]].expectedOut : 0n;

            for (let xi = 0; xi < groupA.length; xi++) {
                const i = groupA[xi];
                const aOut = entries[i].expectedOut;
                const bStart = sameAB ? xi + 1 : 0;
                if (bStart >= groupB.length) continue;
                const maxBAtStart = entries[groupB[bStart]].expectedOut;
                if (aOut + maxBAtStart + maxCOut <= bestTotal) break;

                for (let xj = bStart; xj < groupB.length; xj++) {
                    const j = groupB[xj];
                    const bOut = entries[j].expectedOut;
                    if (aOut + bOut + maxCOut <= bestTotal) break;
                    if (!pairCompatible(entries[i], entries[j])) continue;
                    const cStart = sameBC ? xj + 1 : 0;
                    if (cStart >= groupC.length) continue;
                    for (let xk = cStart; xk < groupC.length; xk++) {
                        const k = groupC[xk];
                        const total = aOut + bOut + entries[k].expectedOut;
                        if (total <= bestTotal) break;
                        if (
                            pairCompatible(entries[i], entries[k]) &&
                            pairCompatible(entries[j], entries[k])
                        ) {
                            bestTotal = total;
                            bestPlan = [i, j, k];
                        }
                    }
                }
            }
        }
    }

    // best_plan != null ⇔ "split beats baseline by > 0.1%" because best_total
    // was pre-seeded to the threshold.
    if (bestPlan !== null) {
        return { kind: "multi", expectedOut: bestTotal };
    }

    if (baselineIdx >= 0) {
        return { kind: "single", expectedOut: baselineOut };
    }

    // No 100% route exists. Best-effort: pick the highest-output entry from
    // any fraction as a single route. This preserves the "always returns
    // something if any route exists" guarantee.
    let bestEntry = entries[0];
    for (const e of entries) {
        if (e.expectedOut > bestEntry.expectedOut) bestEntry = e;
    }
    return { kind: "single", expectedOut: bestEntry.expectedOut };
}
