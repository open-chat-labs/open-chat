<script lang="ts" module>
    import type { Snippet } from "svelte";

    // Minimal contract for virtualised items. `key` must be a stable identity
    // that survives index shifts (e.g. messageId), NOT an array index.
    export type VirtualItem = { key: string };

    export interface Props<T extends VirtualItem> {
        // items[0] = newest (visual bottom), items[N-1] = oldest (visual top)
        items: T[];
        // while true, scrolling is suppressed (overflow-y: hidden) — used by the
        // owner to protect programmatic scrollTop writes from iOS momentum
        interrupt: boolean;
        // scroll distance (px) from the visual bottom; -scrollTop
        fromBottom?: number;
        // renders a single item; receives (item, absoluteIndex)
        row: Snippet<[T, number]>;
        // called on every scroll event (after internal bookkeeping); genuine is
        // false when the event was caused by one of our own scrollTop writes
        onUserScroll?: (genuine: boolean) => void;
        // fired on touchstart (iOS only — where touch listeners are attached);
        // an unambiguous user gesture, unlike scroll events which may be ours
        onUserTouch?: () => void;
        // buckets items into height classes ("date", "text", "media", …) so
        // unmeasured items estimate from their class average instead of the
        // global one — a global average is systematically wrong for every
        // class (date markers are ~40px against a media-inflated ~260px
        // average), and that bias per entering row is what drives scroll
        // compensation pressure during long rides
        estimateClass?: (item: T) => string;
        // true when the newest loaded message is the newest that exists —
        // distinguishes the genuine live bottom (where prepends are followed)
        // from the catch-up wall mid-history (where position is preserved)
        caughtUp?: () => boolean;
        // identifies items that act as date separators for the sticky date
        isDateMarker?: (item: T) => boolean;
        // timestamp for the sticky date; must return a value for date markers
        // and (as the oldest-rendered-row fallback) ideally for all items
        timestampFor?: (item: T) => bigint | undefined;
        // y-position (px) of the floating date element; enables sticky date tracking
        stickyDateElTop?: number;
        stickyDateTimestamp?: bigint;
        id?: string;
        viewportClass?: string;
        viewport?: HTMLDivElement;
        viewportHeight?: number;
    }
</script>

<script lang="ts" generics="T extends VirtualItem">
    /**
     * VirtualChatList — a bi-directional infinite-scroll virtual list for chat
     * messages, using CSS `column-reverse` layout.
     *
     * ## Column-reverse scroll semantics
     *
     *   - scrollTop = 0 means the viewport is at the very bottom (newest messages).
     *   - scrollTop is negative when scrolled up toward older messages.
     *   - fromBottom = -scrollTop (always >= 0).
     *   - items[0] = newest message (visual bottom), items[N-1] = oldest (visual top).
     *   - DOM order: bottomSpacer (first child, visual bottom) → rendered items →
     *     topSpacer (last child, visual top).
     *   - `overflow-anchor: none` is set — the browser will NOT adjust scrollTop
     *     when content changes size.
     *
     * ## Critical asymmetry
     *
     *   Bottom spacer sits at the scroll origin. Changes to it shift ALL visible
     *   content (jank-prone). Top spacer sits at the far end of the scroll range —
     *   changes to it do NOT shift visible content.
     *
     *   This means:
     *   - Forward scroll (toward newer / decreasing fromBottom): items enter from
     *     the bottom spacer → bottom spacer shrinks → content shifts → needs
     *     scrollTop compensation to prevent jank.
     *   - Backward scroll (toward older / increasing fromBottom): items enter from
     *     the top spacer → top spacer shrinks → no visible shift → smooth.
     *
     * ## Height estimation and measurement
     *
     *   Items outside the rendered window have unknown heights. We estimate them
     *   using `spacerAvgHeight` — a snapshot of the running average, frozen at
     *   navigation/init/items-change events. Using a frozen snapshot (rather than
     *   the live average) prevents N×δ drift: if the average changed every time an
     *   item was measured, all unmeasured items' estimates would shift by δ,
     *   causing cumulative spacer drift of N×δ.
     *
     *   When an item enters the rendered window, it's measured synchronously
     *   (via offsetHeight in the Svelte action) before the browser paints.
     *   If the actual height differs from the estimate, we compensate via
     *   `viewport.scrollTop` (not by adjusting the spacer). This prevents
     *   accumulated spacer drift while keeping the viewport visually stable.
     *
     * ## Two update modes
     *
     *   - `updateWindowFull()`: Recomputes everything from scratch. Used on init,
     *     navigation, items change, and viewport resize. Resets spacerAvgHeight
     *     and clears pending corrections.
     *   - `updateWindowIncremental()`: Adjusts spacers incrementally based on which
     *     items entered/left the window. Used during normal scrolling for efficiency
     *     and to keep the bottom spacer consistent with the frozen snapshot.
     *
     * ## Corrective scroll for scrollToIndex
     *
     *   `scrollToIndex` first positions using estimated heights, then waits for
     *   measurements. As each item near the target is measured by ResizeObserver,
     *   a 100ms debounce timer resets. When measurements settle, a corrective
     *   re-scroll fires with accurate measured heights.
     *
     * ## Prepend handling
     *
     *   When newer messages are loaded (prepended at index 0), all existing item
     *   indices shift. The items-change $effect detects this by comparing the
     *   first item's key, adjusts `fromBottom` by the estimated height of the
     *   new items, and calls `updateWindowFull()`. The `keyToHeight` map ensures
     *   measured heights survive the index shift (rebuilt into `heightMap`).
     */
    import { mobileOperatingSystem } from "@utils/devices";
    import { flushSync, onMount, tick, untrack } from "svelte";
    import { vclDebug } from "./vclDebug";
    import {
        computeSpacers as _computeSpacers,
        computeWindow as _computeWindow,
        buildPrefixSums,
        OVERSCAN_PX,
        rowByKey,
    } from "./virtualListUtils";

    let {
        items,
        interrupt,
        fromBottom = $bindable(0),
        row,
        onUserScroll,
        onUserTouch,
        estimateClass,
        caughtUp,
        isDateMarker,
        timestampFor,
        stickyDateElTop,
        stickyDateTimestamp = $bindable(undefined),
        id,
        viewportClass,
        viewport = $bindable(undefined),
        viewportHeight = $bindable(0),
    }: Props<T> = $props();

    // CSS flex gap between items (px). Read from computed style in onMount.
    // Spacer calculations must include inter-item gaps so that content height
    // stays consistent as items enter/leave the rendered window.
    let gapPx = 0;

    // ── Virtual window state ──────────────────────────────────────────────
    // start/end define the slice of `items` currently rendered in the DOM.
    // Items [0, start) are represented by bottomSpacer; [end, items.length)
    // by topSpacer.
    let start = $state(0);
    let end = $state(0);
    let bottomSpacerHeight = $state(0);
    let topSpacerHeight = $state(0);

    // ── Height tracking ────────────────────────────────────────────────────
    // Two parallel stores:
    //   heightMap[i] — index-based array for fast O(1) lookup.
    //   keyToHeight — keyed by item.key (stable identity). Source of truth for
    //     measured heights. Survives index shifts when messages are prepended.
    //   prefixSums — cumulative height array for O(log N) window computation.
    //     prefix[i] = sum(height[0..i-1]). Rebuilt lazily when dirty.
    let heightMap: number[] = [];
    let prefixSums: number[] = [0];
    let prefixDirty = true;
    let keyToHeight = new Map<string, number>();
    let totalMeasuredHeight = 0;
    let measuredCount = 0;
    let averageHeight = 95;

    // ── Per-class height tracking (active when estimateClass is provided) ──
    // itemClass[i] caches the class of items[i]; classSum/classCount track
    // measured heights per class; classSnapshot holds the frozen per-class
    // estimates (same freeze discipline as spacerAvgHeight); estimateMap[i]
    // is the frozen estimate for items[i], realigned on items changes.
    let itemClass: string[] = [];
    let classSum = new Map<string, number>();
    let classCount = new Map<string, number>();
    let classSnapshot = new Map<string, number>();
    let estimateMap: number[] = [];
    // a class with too few samples estimates from the global average
    const MIN_CLASS_SAMPLES = 4;

    function trackClassMeasure(i: number, prev: number, h: number) {
        if (estimateClass === undefined) return;
        const cls = itemClass[i];
        if (cls === undefined) return;
        if (prev > 0) {
            classSum.set(cls, (classSum.get(cls) ?? 0) - prev);
            classCount.set(cls, (classCount.get(cls) ?? 0) - 1);
        }
        classSum.set(cls, (classSum.get(cls) ?? 0) + h);
        classCount.set(cls, (classCount.get(cls) ?? 0) + 1);
    }

    // Project the frozen class snapshot onto per-index estimates after the
    // items array changes shape. Does NOT re-freeze the snapshot.
    function realignEstimates(fromIdx: number = 0) {
        if (estimateClass === undefined) return;
        estimateMap.length = items.length;
        for (let i = fromIdx; i < items.length; i++) {
            estimateMap[i] = classSnapshot.get(itemClass[i]) ?? spacerAvgHeight;
        }
    }

    // Full rebuild of heightMap and prune keyToHeight to only keys present in
    // the current items (prevents unbounded growth when items are replaced,
    // e.g. navigating to a different event window).
    function rebuildHeightMap() {
        heightMap = new Array(items.length).fill(0);
        totalMeasuredHeight = 0;
        measuredCount = 0;
        classSum = new Map();
        classCount = new Map();
        if (estimateClass !== undefined) itemClass = items.map(estimateClass);
        const prunedHeights = new Map<string, number>();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const h = keyToHeight.get(item.key);
            if (h !== undefined && h > 0) {
                heightMap[i] = h;
                prunedHeights.set(item.key, h);
                totalMeasuredHeight += h;
                measuredCount++;
                trackClassMeasure(i, 0, h);
            }
        }
        keyToHeight = prunedHeights;
        if (measuredCount > 0) averageHeight = totalMeasuredHeight / measuredCount;
        realignEstimates();
        prefixDirty = true;
    }

    // Incremental extension for append-only changes (older messages loaded at
    // the end). O(numNew) instead of O(N) — reuses existing heightMap entries
    // for indices 0..fromIdx-1 without recomputing.
    function extendHeightMap(fromIdx: number) {
        heightMap.length = items.length;
        if (estimateClass !== undefined) {
            itemClass.length = items.length;
            for (let i = fromIdx; i < items.length; i++) {
                itemClass[i] = estimateClass(items[i]);
            }
        }
        for (let i = fromIdx; i < items.length; i++) {
            const item = items[i];
            const h = keyToHeight.get(item.key);
            if (h !== undefined && h > 0) {
                heightMap[i] = h;
                totalMeasuredHeight += h;
                measuredCount++;
                trackClassMeasure(i, 0, h);
            } else {
                heightMap[i] = 0;
            }
        }
        if (measuredCount > 0) averageHeight = totalMeasuredHeight / measuredCount;
        realignEstimates(fromIdx);
        prefixDirty = true;
    }

    // Rebuild prefix sums from heightMap + spacerAvgHeight.
    // Called lazily before computeWindow/computeSpacers when prefixDirty is set.
    // O(N), but batches ALL height changes since the last rebuild into one pass.
    // This is strictly better than incremental O(N-i)-per-change updates during
    // burst scenarios (initial render, resize) where many items measure at once:
    // one O(N) rebuild vs O(windowSize × N) total for per-item updates.
    function ensurePrefixSums() {
        if (!prefixDirty) return;
        prefixSums = buildPrefixSums(
            items.length,
            heightMap,
            spacerAvgHeight,
            estimateClass !== undefined ? estimateMap : undefined,
        );
        prefixDirty = false;
    }

    // Re-freeze the estimate space: the global average plus each class's
    // average (classes with too few samples inherit the global), projected
    // onto per-index estimates. Same freeze points as spacerAvgHeight alone
    // used to have — estimates must stay stable between these points or every
    // unmeasured item's contribution drifts under the user (N×δ).
    function refreshEstimateSnapshot() {
        spacerAvgHeight = averageHeight;
        if (estimateClass !== undefined) {
            classSnapshot = new Map();
            for (const [cls, count] of classCount) {
                if (count >= MIN_CLASS_SAMPLES) {
                    classSnapshot.set(cls, (classSum.get(cls) ?? 0) / count);
                }
            }
            realignEstimates();
        }
        prefixDirty = true;
    }

    // ── spacerAvgHeight (frozen estimate snapshot) ───────────────────────
    // Snapshot of averageHeight, frozen at navigation/init/items-change.
    // All spacer calculations use this instead of the live averageHeight so
    // that unmeasured items contribute a stable estimate between resets.
    // Without this, each measurement updates averageHeight, shifting every
    // unmeasured item's estimate, causing cumulative spacer drift of N×δ.
    let spacerAvgHeight = 95;

    // ── Pending bottom corrections ─────────────────────────────────────────
    // When an unmeasured item enters the rendered window from the bottom spacer,
    // the spacer shrinks by the estimated height (spacerAvgHeight). If the item's
    // actual DOM height differs, we compensate viewport.scrollTop (not the spacer)
    // in measureRow to prevent visible shifts. This map tracks which items entered
    // at which estimate, so we know the delta when measuring.
    let pendingBottomCorrections = new Map<number, number>();

    // Use the frozen estimate space for ALL unmeasured item estimates.
    // This keeps computeWindow and spacer calculations consistent — prevents
    // oscillation when averageHeight drifts from spacerAvgHeight during measurements.
    function getHeight(i: number): number {
        if (heightMap[i] > 0) return heightMap[i];
        return estimateMap[i] ?? spacerAvgHeight;
    }

    function computeWindow(): [number, number] {
        ensurePrefixSums();
        return _computeWindow(
            items.length,
            prefixSums,
            fromBottom,
            viewportHeight,
            OVERSCAN_PX,
            gapPx,
        );
    }

    function computeSpacers(s: number, e: number): [number, number] {
        ensurePrefixSums();
        return _computeSpacers(items.length, prefixSums, s, e, gapPx);
    }

    // A corrupted estimate or bookkeeping bug can produce a non-finite or
    // absurd spacer height; feeding that to the DOM makes every layout pass
    // catastrophically slow (which diagnostics sampling then amplifies into a
    // dead tab). Clamp and shout instead.
    const MAX_SANE_SPACER = 5_000_000;
    function sanitizeSpacers(bh: number, th: number): [number, number] {
        if (!Number.isFinite(bh) || !Number.isFinite(th) || bh > MAX_SANE_SPACER || th > MAX_SANE_SPACER) {
            vclDebug.log("!spacer-insane", { bh: Math.round(bh), th: Math.round(th) });
            bh = Number.isFinite(bh) ? Math.min(Math.max(bh, 0), MAX_SANE_SPACER) : 0;
            th = Number.isFinite(th) ? Math.min(Math.max(th, 0), MAX_SANE_SPACER) : 0;
        }
        return [bh, th];
    }

    // Clamp a scrollTop-derived fromBottom so it can never point past the oldest
    // item. A stale/in-flight scroll value (common on iOS — e.g. when a window
    // replacement shrinks the content under an old scroll position) can otherwise
    // put fromBottom beyond the content extent, making computeWindow return an
    // empty window → the whole list renders blank. The OVERSCAN_PX margin keeps
    // this a pure safety net: legitimate top-of-list positions are never clamped.
    function clampFromBottom(raw: number): number {
        const n = items.length;
        if (n === 0) return 0;
        ensurePrefixSums();
        const contentExtent = prefixSums[n] + Math.max(0, n - 1) * gapPx;
        const maxFromBottom = Math.max(0, contentExtent - viewportHeight + OVERSCAN_PX);
        if (raw > maxFromBottom + 1) {
            vclDebug.log("!clamp", { raw: Math.round(raw), max: Math.round(maxFromBottom), n });
        }
        return Math.min(Math.max(0, raw), maxFromBottom);
    }

    // Repay outstanding spacer debt inline, adjusting fromBottom additively
    // (NOT from scrollTop — callers like the prepend path set fromBottom to a
    // value the browser's scrollTop hasn't caught up with yet). Used by the
    // position-preserving full/jump recomputes: assigning the canonical
    // spacer height over a debt-offset DOM spacer without the matching
    // scrollTop write would shift content by the outstanding debt.
    function repayDebtInline(reason: string) {
        if (spacerDebt === 0 || !viewport) return;
        const debt = spacerDebt;
        spacerDebt = 0;
        viewport.scrollTop -= debt;
        fromBottom += debt;
        lastProgrammaticScrollTime = Date.now();
        vclDebug.log("repay", { debt: Math.round(debt), during: reason });
    }

    // Full recompute: used on init, navigation, items change, resize.
    function updateWindowFull(reason: string = "unknown") {
        // Navigation resets (scroll-to-index/bottom) reposition the viewport
        // absolutely right after this call, so outstanding debt is moot and
        // must be discarded WITHOUT a scrollTop write (the write would fight
        // the navigation's own positioning). Every other reason preserves the
        // reading position: when the user is not actively scrolling, repay
        // the debt before the canonical spacer assignment below overwrites
        // the DOM offset. MID-GESTURE the repayment write itself is the
        // hazard — it kills iOS native momentum (observed as heavy glitching
        // when a forward scroll crosses a load boundary) — so instead the
        // debt is carried through the recompute (the assignment subtracts it,
        // preserving the DOM offset) and the gesture-end settle repays it.
        const navReset = reason === "scroll-to-index" || reason === "scroll-to-bottom";
        if (navReset) {
            spacerDebt = 0;
        } else if (!scrollingActive()) {
            repayDebtInline(reason);
        }
        // Only re-freeze the estimate space if the average actually changed,
        // to avoid redundant O(N) rebuilds when callers (e.g. _doScrollToIndex)
        // have already refreshed it and rebuilt prefix sums.
        //
        // NEVER re-freeze at interrupt-end: the owner's restore just pinned an
        // anchor row's exact screen position, but the rows rendered for the
        // new window measure between that restore and this recompute, moving
        // the live average. Re-freezing here re-estimates every unmeasured row
        // below the viewport, changing the bottom spacer under the anchor —
        // a visible position jump at every load boundary, at any speed. The
        // recompute must run in the same estimate space the restore was
        // computed against; the next natural refresh point (items change,
        // navigation, resize — which all compensate) picks up the new average.
        if (reason !== "interrupt-end" && spacerAvgHeight !== averageHeight) {
            refreshEstimateSnapshot();
        }
        const [s, e] = computeWindow();
        let [bh, th] = computeSpacers(s, e);
        [bh, th] = sanitizeSpacers(bh, th);
        // Carry outstanding (mid-gesture) debt across the canonical
        // assignment: the DOM spacer keeps its offset, so nothing shifts and
        // no scrollTop write is needed. Clamp so the DOM spacer stays >= 0.
        if (spacerDebt !== 0) {
            if (spacerDebt > bh) {
                // Forgiving debt here leaves the DOM offset unmatched by the
                // ledger — the repay that eventually fires moves scrollTop by
                // less than the offset applied earlier.
                vclDebug.log("!debt-clamped", {
                    debt: Math.round(spacerDebt),
                    bh: Math.round(bh),
                    reason,
                });
                spacerDebt = bh;
            }
            bh -= spacerDebt;
        }
        vclDebug.log("full", {
            reason,
            fb: Math.round(fromBottom),
            s,
            e,
            bh: Math.round(bh),
            th: Math.round(th),
            avg: Math.round(spacerAvgHeight),
        });
        start = s;
        end = e;
        bottomSpacerHeight = bh;
        topSpacerHeight = th;
        pendingBottomCorrections.clear();
        tick().then(rebuildDateMarkerCache);
    }

    // ── Incremental update (scroll handler) ───────────────────────────────
    // During normal scrolling, we adjust spacers incrementally rather than
    // recomputing from scratch. This keeps the bottom spacer consistent with
    // the frozen spacerAvgHeight snapshot.
    //
    // Bottom spacer: tracked incrementally. When items enter from the spacer,
    // we subtract their estimated height. When items leave back to the spacer,
    // we add their (now-measured) height. The pendingBottomCorrections mechanism
    // handles the estimate→actual mismatch via scrollTop compensation.
    //
    // Top spacer: fully recomputed each time (safe — changes to the top spacer
    // don't shift visible content in column-reverse).
    function updateWindowIncremental() {
        let [s, e] = computeWindow();

        if (s === start && e === end) return;

        // For large window shifts (drag-scroll, PageUp, programmatic jumps),
        // the incremental bottom spacer loop becomes O(|s-start|) which can
        // be large. Fall back to a full recompute — the visual position is
        // being reset anyway so pendingBottomCorrections don't matter.
        const INCREMENTAL_THRESHOLD = 50;
        if (Math.abs(s - start) > INCREMENTAL_THRESHOLD) {
            // The canonical spacer assignment below would silently overwrite
            // any debt-offset DOM spacer, shifting content under the reading
            // position — repay first (the repayment moves fromBottom, so the
            // window must be recomputed). Mid-gesture, carry the debt across
            // the assignment instead: the write would kill native momentum.
            if (spacerDebt !== 0 && !scrollingActive()) {
                repayDebtInline("incr-jumped");
                [s, e] = computeWindow();
            }
            let [bh, th] = computeSpacers(s, e);
            if (spacerDebt !== 0) {
                if (spacerDebt > bh) {
                    vclDebug.log("!debt-clamped", {
                        debt: Math.round(spacerDebt),
                        bh: Math.round(bh),
                        reason: "incr-jumped",
                    });
                    spacerDebt = bh;
                }
                bh -= spacerDebt;
            }
            vclDebug.log("incr-jumped", { s, e, bh: Math.round(bh), th: Math.round(th) });
            start = s;
            end = e;
            bottomSpacerHeight = bh;
            topSpacerHeight = th;
            pendingBottomCorrections.clear();
            // the date-marker cache belongs to the rows that just left the
            // window — without a rebuild the sticky date shows a stale day
            // until the next small scroll or full recompute
            tick().then(rebuildDateMarkerCache);
            return;
        }

        // Bottom spacer: adjust incrementally for items entering/leaving.
        // In addition to item heights, we must adjust for inter-item gaps that
        // the spacer absorbs. A spacer representing K items has max(0, K-1) gaps.
        if (s > start) {
            // Scrolling backward: items at bottom of window leave → bottom spacer.
            // Add back their height (measured or estimated).
            for (let i = start; i < s; i++) {
                bottomSpacerHeight += getHeight(i);
                pendingBottomCorrections.delete(i);
            }
            // More items in spacer → more inter-item gaps
            const gapDelta = Math.max(0, s - 1) - Math.max(0, start - 1);
            bottomSpacerHeight += gapDelta * gapPx;
        } else if (s < start) {
            // Scrolling forward: items enter rendered window from bottom spacer.
            // Subtract their estimated height. Track unmeasured ones for scrollTop
            // compensation when their actual height is measured.
            for (let i = s; i < start; i++) {
                const est = getHeight(i);
                bottomSpacerHeight -= est;
                if (!(heightMap[i] > 0)) {
                    pendingBottomCorrections.set(i, est);
                }
            }
            // Fewer items in spacer → fewer inter-item gaps
            const gapDelta = Math.max(0, s - 1) - Math.max(0, start - 1);
            bottomSpacerHeight += gapDelta * gapPx;
        }

        // Top spacer: O(1) via prefix sums (safe — changes don't shift visible content).
        const topCount = items.length - e;
        let th = prefixSums[items.length] - prefixSums[e];
        if (topCount > 1) th += (topCount - 1) * gapPx;
        topSpacerHeight = th;

        if (bottomSpacerHeight < 0) {
            // The clamp below silently adds |bh| px of content height with no
            // matching scrollTop or debt adjustment — the visible shift. Full
            // ledger context to pin down where the sign drift comes from:
            // canon = what the spacer would be with outstanding debt repaid.
            vclDebug.log("!negative-spacer", {
                bh: Math.round(bottomSpacerHeight),
                s,
                e,
                oldS: start,
                oldE: end,
                debt: Math.round(spacerDebt),
                canon: Math.round(bottomSpacerHeight + spacerDebt),
                fb: Math.round(fromBottom),
                touch: isTouching,
                mom: isMomentumScrolling,
                pend: [...pendingBottomCorrections.entries()]
                    .slice(0, 12)
                    .map(([i, est]) => `${i}:${Math.round(est)}`)
                    .join(" "),
            });
            // A negative DOM spacer near the bottom is outstanding debt with
            // no spacer room left to live in (canonical → 0 as s → 0): the
            // clamp below materialises the deficit as a content shift, so the
            // matching ledger debt must be forgiven. Keeping it recorded makes
            // the next carry/repay re-apply the offset against a DOM that no
            // longer holds it — a second, opposite jolt.
            if (spacerDebt > 0) {
                const forgiven = Math.min(spacerDebt, -bottomSpacerHeight);
                spacerDebt -= forgiven;
                vclDebug.log("debt-forgiven", { forgiven: Math.round(forgiven) });
            }
        }
        // Settle any remaining debt as soon as the window reaches the newest
        // edge, while there is still scroll room for the atomic repay write.
        // At the physical wall the write clamps against the boundary and the
        // spacer half of the repay lands alone — negative debt in particular
        // shows as a phantom gap at the very bottom that later snaps shut
        // (observed as a twitch while parked at the catch-up wall).
        if (
            s === 0 &&
            spacerDebt !== 0 &&
            viewport &&
            -viewport.scrollTop > Math.abs(spacerDebt) + 50 &&
            !isTouching
        ) {
            queueMicrotask(() => settleSpacerDebt(true));
        }
        bottomSpacerHeight = Math.max(0, bottomSpacerHeight);
        [bottomSpacerHeight, topSpacerHeight] = sanitizeSpacers(bottomSpacerHeight, topSpacerHeight);

        vclDebug.log("incr", {
            s,
            e,
            bh: Math.round(bottomSpacerHeight),
            th: Math.round(topSpacerHeight),
            pend: pendingBottomCorrections.size,
            debt: Math.round(spacerDebt),
        });

        start = s;
        end = e;
        tick().then(rebuildDateMarkerCache);
    }


    // ── Synthetic momentum continuation (iOS) ─────────────────────────────
    // Crossing a load boundary needs the scroll interrupt (the restore write
    // must not be clobbered by native physics), but the interrupt also kills
    // the user's fling dead — every forward boundary was a hard stop. Native
    // momentum cannot be restarted, so we continue it ourselves: sample the
    // fling velocity from genuine scroll events, and when the interrupt ends
    // JS-animate the remaining glide with iOS's own deceleration curve.
    // Programmatic writes are safe at that point — there is no native
    // momentum left to fight — and the glide's scroll events drive loads and
    // window updates exactly like the native fling did, so the velocity
    // carries across subsequent boundaries too.
    let glideRaf: number | undefined;
    let glideVelocity = 0; // px/ms, positive = towards the bottom
    let sampleTime = 0; // performance.now() of the last genuine scroll sample
    let sampleTop = 0;
    let sampledVelocity = 0;
    let capturedGlideVelocity = 0;
    const GLIDE_MIN_START = 0.15; // px/ms — slower flings aren't worth faking
    const GLIDE_MIN_KEEP = 0.02;
    const GLIDE_DECAY_PER_MS = 0.998; // UIScrollView's normal deceleration rate

    function cancelGlide() {
        if (glideRaf !== undefined) cancelAnimationFrame(glideRaf);
        glideRaf = undefined;
        glideVelocity = 0;
    }

    function startGlide(v: number) {
        cancelGlide();
        glideVelocity = v;
        let last = performance.now();
        vclDebug.log("glide-start", { v: Math.round(v * 1000) });
        const step = (t: number) => {
            glideRaf = undefined;
            if (!viewport || interrupt || isTouching) {
                glideVelocity = 0;
                return;
            }
            const dt = Math.min(t - last, 64);
            last = t;
            const before = viewport.scrollTop;
            viewport.scrollTop = before + glideVelocity * dt;
            lastProgrammaticScrollTime = Date.now();
            glideVelocity *= Math.pow(GLIDE_DECAY_PER_MS, dt);
            // an unchanged scrollTop means the browser clamped us at an edge
            if (Math.abs(glideVelocity) < GLIDE_MIN_KEEP || viewport.scrollTop === before) {
                vclDebug.log("glide-end", { st: Math.round(viewport.scrollTop) });
                glideVelocity = 0;
                return;
            }
            glideRaf = requestAnimationFrame(step);
        };
        glideRaf = requestAnimationFrame(step);
    }

    // After interrupt ends (scroll restored), sync fromBottom and do a full recompute
    // so spacer state is consistent with the restored scroll position.
    $effect(() => {
        if (interrupt) {
            untrack(() => {
                // Capture the fling for continuation: an active synthetic
                // glide's velocity, or the freshly sampled native one when
                // momentum was live as the interrupt began.
                capturedGlideVelocity = 0;
                const v =
                    glideRaf !== undefined
                        ? glideVelocity
                        : isMomentumScrolling && performance.now() - sampleTime < 250
                          ? sampledVelocity
                          : 0;
                cancelGlide();
                if (mobileOperatingSystem === "iOS" && !isTouching && Math.abs(v) > GLIDE_MIN_START) {
                    capturedGlideVelocity = v;
                }
            });
        } else if (viewport) {
            untrack(() => {
                vclDebug.log("interrupt-end", { st: Math.round(viewport!.scrollTop) });
                // Deferred adjustments were computed against the pre-interrupt
                // positions; the restore has just resynced everything, so
                // flushing them now would be a stale jolt on landing.
                pendingScrollAdjustment = 0;
                pendingSnapToBottom = false;
                // Anchor across the recompute below: it can shift the window
                // (the repay moves fromBottom) and rows newly pulled into the
                // window render at their real height against an estimate-sized
                // spacer with no pending-correction entry — the estimate error
                // lands as a raw shift. Same-flush re-anchoring absorbs it.
                const pinRow = viewport!.querySelector<HTMLElement>(".vcl-row");
                const pinKey = pinRow?.dataset.key;
                const pinTop = pinRow?.getBoundingClientRect().top;
                // The interrupt has already killed any native momentum, so a
                // repay write here is free — and outstanding debt carried into
                // a wall approach otherwise materialises as a clamp shift per
                // entering item (device trace: +1070px of debt bled out as ten
                // successive jolts). Only an active finger forbids the write.
                if (!isTouching) {
                    repayDebtInline("interrupt-end");
                }
                fromBottom = clampFromBottom(-viewport!.scrollTop);
                updateWindowFull("interrupt-end");
                if (pinKey !== undefined && fromBottom > 10) {
                    tick().then(() => {
                        if (!viewport || interrupt) return;
                        const again = rowByKey(viewport, pinKey);
                        if (!again || pinTop === undefined) return;
                        const delta = again.getBoundingClientRect().top - pinTop;
                        if (Math.abs(delta) < 1) return;
                        viewport.scrollTop += delta;
                        vclDebug.log("interrupt-pin", { delta: Math.round(delta) });
                        lastProgrammaticScrollTime = Date.now();
                    });
                }
                if (capturedGlideVelocity !== 0) {
                    startGlide(capturedGlideVelocity);
                    capturedGlideVelocity = 0;
                }
            });
        }
    });

    $effect(() => {
        void stickyDateElTop;
        untrack(updateStickyDate);
    });

    // ── Corrective scroll state ────────────────────────────────────────────
    // scrollToIndex first positions using estimated heights. As measureRow
    // fires for items near the target, it resets a 100ms debounce timer.
    // When measurements settle, the timer fires and re-scrolls with accurate
    // measured heights. This repeats up to MAX_SCROLL_CORRECTIONS times so
    // that each round of newly-measured items can further refine the position.
    let pendingScrollFlatIdx: number | undefined;
    let scrollCorrectTimer: number | undefined;
    let scrollCorrectCount = 0;
    let pendingScrollStartedAt = 0;
    const MAX_SCROLL_CORRECTIONS = 3;
    // A pending corrective scroll must not stay armed indefinitely: row
    // measurements near the target can arrive long after the navigation (image
    // loads, reflows, edits) and would otherwise yank the viewport back to a
    // target the user has finished with.
    const SCROLL_CORRECTION_TTL_MS = 2000;

    // Timestamp of last programmatic scrollTop change. Used to distinguish
    // programmatic scrolls (corrections, scrollToIndex, measureRow compensation)
    // from genuine user scrolls. Prevents the corrective scroll from being
    // cancelled by scroll events we ourselves triggered.
    let lastProgrammaticScrollTime = 0;

    // ── iOS momentum scroll tracking ──────────────────────────────────────
    // On iOS, setting scrollTop during a momentum scroll cancels native
    // physics. We accumulate adjustments while a touch or momentum scroll is
    // active and flush once the scroll settles.
    //
    // Detection strategy:
    //   - touchstart/touchend track finger contact.
    //   - scrollend (iOS 16+) fires exactly when momentum stops → flush immediately.
    //   - Fallback for older browsers: onScroll resets a 100ms idle timer on
    //     every scroll event. When no scroll event arrives for 100ms the scroll
    //     has stopped and we flush. On touchend with no subsequent scroll events
    //     (no momentum) a shorter 50ms timer fires first.
    let isTouching = false;
    let isMomentumScrolling = false;
    let pendingScrollAdjustment = 0;
    let pendingSnapToBottom = false;
    let momentumEndTimer: ReturnType<typeof setTimeout> | undefined;

    // ── Spacer debt (desktop smooth-scroll preservation) ──────────────────
    // A programmatic scrollTop write aborts the browser's in-flight smooth
    // wheel animation (CSSOM), so applying a measurement compensation on every
    // item entering from the bottom spacer makes wheel scrolling feel bumpy.
    // While the user is actively scrolling we instead absorb the correction
    // into the bottom spacer itself: shrinking/growing the spacer by the same
    // delta keeps the total content height — and therefore the visible content
    // — stable without touching scrollTop at all. The accumulated deviation of
    // the DOM spacer from its canonical (bookkeeping) height is tracked here
    // as debt, bounded well inside the overscan margin, and repaid with a
    // single scrollTop write once the scroll goes idle (when an abort no
    // longer matters) or at the next full window recompute.
    // debt = canonicalSpacerHeight - domSpacerHeight
    let spacerDebt = 0;
    // While a touch/momentum gesture is active the settle cannot run anyway
    // (a write would kill native physics), so the only hard constraint on the
    // debt is the overscan margin — beyond it the rendered window and the
    // scroll position disagree visibly. The tight cap forced mid-gesture
    // corrections onto the deferred-write path (an uncompensated shift per
    // entering item — observed on iOS as choppiness once the estimate bias
    // accumulated ~400px over ~10 items).
    const MAX_SPACER_DEBT_GESTURE = OVERSCAN_PX;
    let lastUserScrollTime = 0;
    // Time of the last scroll event of ANY origin. lastUserScrollTime alone is
    // not a safe activity signal: each of our own scrollTop writes suppresses
    // the genuine-scroll detection for 100ms, so during a busy stretch (repay,
    // then per-entering-item compensations) the user clock goes stale while
    // the user is still mid-gesture — absorption switches off and every
    // correction becomes a write, each of which re-poisons the next window (a
    // self-sustaining write storm, observed on iOS as per-item jolts).
    let lastScrollEventTime = 0;
    let debtIdleTimer: ReturnType<typeof setTimeout> | undefined;
    const MAX_SPACER_DEBT = 400;

    // The window in which a scrollTop write would disturb the user: an active
    // touch, native momentum, or the tail of a wheel glide.
    function scrollingActive(): boolean {
        return (
            isTouching ||
            isMomentumScrolling ||
            Date.now() - lastUserScrollTime < 200 ||
            Date.now() - lastScrollEventTime < 150
        );
    }

    function canAbsorbIntoSpacer(delta: number): boolean {
        // Absorption is a pure layout change (spacer and entering row commit in
        // the same flush, net zero height) with no scrollTop write, so it is
        // safe — and essential — during touch/momentum scrolling too: without
        // it every entering item's estimate error shifts the content
        // mid-gesture (observed on iOS as per-message 'vibration' when
        // scrolling forward through unmeasured history).
        if (!scrollingActive()) {
            return false;
        }
        // Declines during an active gesture push the correction onto a write
        // (or deferred-write) path — exactly the mid-gesture jolt hazard — so
        // each decline reason is worth a trace line. A spacer too small to
        // absorb is the normal state near the bottom of the list.
        if (bottomSpacerHeight - delta < 0) {
            vclDebug.log("!absorb-declined", {
                why: "spacer-too-small",
                bh: Math.round(bottomSpacerHeight),
                delta: Math.round(delta),
                debt: Math.round(spacerDebt),
                fb: Math.round(fromBottom),
            });
            return false;
        }
        // During touch/momentum a settle write would kill the native physics,
        // so the gesture cap is the overscan margin; outside a gesture the
        // tight cap keeps the repayment write small.
        const cap =
            isTouching || isMomentumScrolling ? MAX_SPACER_DEBT_GESTURE : MAX_SPACER_DEBT;
        // A single correction bigger than the cap (a very tall item measured
        // against the average estimate) must go straight to the scroll
        // adjustment path — if we absorbed it we would immediately be forced
        // to repay it mid-scroll.
        if (Math.abs(delta) >= cap) {
            vclDebug.log("!absorb-declined", {
                why: "single-delta-cap",
                delta: Math.round(delta),
                cap,
            });
            return false;
        }
        // On a long sustained scroll the debt never gets an idle moment to be
        // repaid; once the cap would be exceeded, force a single repayment
        // write rather than degrading to a write per entering item — except
        // mid-gesture, where only the deferred path remains beyond the cap.
        if (Math.abs(spacerDebt + delta) >= cap) {
            if (isTouching || isMomentumScrolling) {
                vclDebug.log("!absorb-declined", {
                    why: "cap-mid-gesture",
                    delta: Math.round(delta),
                    debt: Math.round(spacerDebt),
                    cap,
                });
                return false;
            }
            // This call site is usually inside a render flush (measureRow
            // during row creation), where settle's flushSync throws and falls
            // back to a revert-and-retry that is non-atomic for one frame —
            // observed as a one-frame glitch when the cap trips mid-glide.
            // Deferring to a microtask keeps the settle atomic; the absorb
            // below proceeds and the settle repays the new total.
            queueMicrotask(() => settleSpacerDebt(true));
        }
        return bottomSpacerHeight - delta >= 0;
    }

    function absorbIntoSpacer(delta: number) {
        bottomSpacerHeight -= delta;
        spacerDebt += delta;
        vclDebug.log("debt", { delta: Math.round(delta), total: Math.round(spacerDebt) });
        clearTimeout(debtIdleTimer);
        debtIdleTimer = setTimeout(settleSpacerDebt, 300);
    }

    // Repay outstanding debt: restore the canonical spacer height and move
    // scrollTop by the same amount, atomically before the next paint, so the
    // visible content does not move. Deferred while the user is still
    // scrolling — chrome fires scrollend between individual wheel notches, so
    // "scroll ended" alone is not a safe signal that the glide is over.
    function settleSpacerDebt(force = false, retried = false) {
        clearTimeout(debtIdleTimer);
        debtIdleTimer = undefined;
        if (spacerDebt === 0 || !viewport) return;
        // scrollingActive() covers touch, momentum, AND the any-origin scroll
        // event stream — the user-scroll clock alone goes stale when our own
        // writes suppress genuine detection, and repays were observed firing
        // milliseconds apart in the middle of a live iOS scroll stream.
        if (!force && (scrollingActive() || Date.now() - lastUserScrollTime < 250)) {
            debtIdleTimer = setTimeout(() => settleSpacerDebt(), 300);
            return;
        }
        const debt = spacerDebt;
        spacerDebt = 0;
        // flushSync commits the spacer height to the DOM in this task, so the
        // spacer change and the scrollTop write land in the same layout. It is
        // not permitted inside an effect flush — in that (rare: every direct
        // caller is a timer or event handler) case, put the debt back and
        // retry ONCE in a microtask, which runs after the flush completes.
        // The retry must be bounded: flushSync also rethrows anything the
        // synchronous re-render throws, and retrying that forever is an
        // infinite microtask spin — a complete hang. On the second failure
        // fall back to the split (non-atomic) write; a one-frame residual
        // beats a dead tab.
        try {
            flushSync(() => {
                bottomSpacerHeight += debt;
            });
        } catch {
            if (!retried) {
                spacerDebt = debt;
                queueMicrotask(() => settleSpacerDebt(force, true));
                return;
            }
            vclDebug.log("!settle-fallback", { debt: Math.round(debt) });
            bottomSpacerHeight += debt;
        }
        viewport.scrollTop -= debt;
        lastProgrammaticScrollTime = Date.now();
        fromBottom = clampFromBottom(-viewport.scrollTop);
        vclDebug.log("repay", { debt: Math.round(debt) });
    }

    // Track previous items to detect prepend vs append vs replacement.
    // NOTE: this $effect.pre must be declared AFTER the spacer-debt state
    // above — pre-effects can run during the init flush, before later
    // declarations are initialised (TDZ).
    let prevFirstKey: string | undefined;
    let prevLastKey: string | undefined;
    let prevItemsLength = 0;

    // Recompute the virtual window whenever items change.
    // $effect.pre is load-bearing: visibleItems ($derived) re-renders rows with
    // the NEW items array immediately, so start/end/spacers must be updated in
    // the same flush BEFORE the DOM is touched. With a plain $effect there is
    // one frame where the stale window slices the new array — wrong rows
    // render, and their synchronous measurements compare fresh DOM heights
    // against the not-yet-rebuilt heightMap, producing garbage resize deltas
    // and spurious scroll compensations.
    $effect.pre(() => {
        // Register reactive dependency on items contents
        void items.length;
        void items[0]?.key;

        untrack(() => {
            const oldLen = prevItemsLength;
            const oldFirstKey = prevFirstKey;
            const oldLastKey = prevLastKey;
            prevFirstKey = items[0]?.key;
            prevLastKey = items.length > 0 ? items[items.length - 1].key : undefined;
            prevItemsLength = items.length;

            const numNew = items.length - oldLen;

            // Anchor the user's position across this items pass: the rebuild
            // below can move the live average (freshly measured rows), and
            // updateWindowFull then re-freezes the estimate space — changing
            // every unmeasured row's contribution to the bottom spacer with
            // no compensation. On a same-length store re-emit (read receipts,
            // reactions) mid-scroll that surfaced as a one-frame ~300-900px
            // position jump, always in high-estimate-drift zones. The rect is
            // captured pre-DOM-update; the re-anchor write lands post-update,
            // pre-paint (same discipline as the prepend pin).
            const pinRow = viewport?.querySelector<HTMLElement>(".vcl-row");
            const pinKey = pinRow?.dataset.key;
            const pinTop = pinRow?.getBoundingClientRect().top;
            const preFromBottom = fromBottom;

            // Detect prepend: items grew and the old first item was shifted
            // right. Its new index is USUALLY numNew, but a date marker can be
            // inserted or moved at the join (the new batch starts a new day),
            // so search a small neighbourhood for the old first key instead of
            // requiring exact equality — a strict check silently misses the
            // prepend and the position teleports by the batch height.
            let prependCount = 0;
            if (numNew > 0 && oldLen > 0 && oldFirstKey !== undefined) {
                const scanMax = Math.min(items.length - 1, numNew + 8);
                for (let i = 1; i <= scanMax; i++) {
                    if (items[i]?.key === oldFirstKey) {
                        prependCount = i;
                        break;
                    }
                }
            }
            const isPrepend = prependCount > 0;

            // Detect pure append: items grew, first key unchanged, AND the
            // previously-last item is still at its old index. This guards against
            // date marker shifts when older messages share a day with the current
            // oldest — in that case the flattening may insert/move items within
            // the existing range, so a full rebuild is needed.
            const isAppend =
                numNew > 0 &&
                oldLen > 0 &&
                items[0]?.key === oldFirstKey &&
                items[oldLen - 1]?.key === oldLastKey;

            if (isAppend) {
                extendHeightMap(oldLen);
            } else {
                rebuildHeightMap();
            }

            // Refresh the estimate snapshot BEFORE computing the prepend offset:
            // updateWindowFull below will refresh it anyway, and if the offset
            // were computed with the old snapshot the adjusted fromBottom would
            // point at a different item in the new estimate space — the window
            // lands away from the previously-visible content and the caller's
            // post-load anchor row is not even rendered.
            if (spacerAvgHeight !== averageHeight) {
                refreshEstimateSnapshot();
            }

            let prependOffset = 0;
            if (isPrepend) {
                // New items were prepended at the visual bottom (scroll origin
                // in column-reverse). Adjust fromBottom so updateWindowFull
                // targets the same visual position in the new index space.
                // Reset the pin FIRST: if this pass takes the follow path
                // (no pin), the owner must not read a previous boundary's pin.
                lastPrependPinTarget = undefined;
                let offset = 0;
                for (let i = 0; i < prependCount; i++) {
                    offset += getHeight(i);
                }
                // Include gaps: prependCount new items add prependCount gaps
                // (one per item plus the gap between last new item and old
                // first item).
                offset += prependCount * gapPx;
                fromBottom += offset;
                prependOffset = offset;
            }

            vclDebug.log("items", {
                len: items.length,
                numNew,
                prepend: isPrepend,
                append: isAppend,
                offset: Math.round(prependOffset),
                fb: Math.round(fromBottom),
            });

            updateWindowFull("items");

            // Re-anchor in the SAME flush that renders this pass: the owner's
            // restore (if any) runs a task later and the browser paints the
            // shifted content in between. tick() resolves after this flush's
            // DOM update but before the paint, so the anchor-exact write is
            // invisible. Applies to prepends (whose estimate offset above is
            // approximate) AND to same-length re-emits (whose estimate-space
            // re-freeze moves the spacers with no compensation at all). At
            // the genuine live bottom the view must FOLLOW new content
            // instead — but the catch-up wall mid-history also sits at
            // fromBottom 0, and only the owner can tell the two apart.
            const follow = preFromBottom < 10 && (caughtUp?.() ?? true);
            if (!follow && pinKey !== undefined && oldLen > 0) {
                tick().then(() => {
                    if (!viewport || interrupt) return;
                    const again = rowByKey(viewport, pinKey);
                    const before = viewport.scrollTop;
                    if (again && pinTop !== undefined) {
                        const delta = again.getBoundingClientRect().top - pinTop;
                        if (Math.abs(delta) < 1 && !isPrepend) return;
                        viewport.scrollTop += delta;
                    } else if (isPrepend) {
                        // anchor left the window — estimate-space fallback
                        viewport.scrollTop = -fromBottom;
                    } else {
                        // replacement/navigation: nothing sensible to pin to
                        return;
                    }
                    if (isPrepend) lastPrependPinTarget = viewport.scrollTop;
                    vclDebug.log(isPrepend ? "prepend-pin" : "items-pin", {
                        anchored: !!again,
                        from: Math.round(before),
                        to: Math.round(viewport.scrollTop),
                    });
                    lastProgrammaticScrollTime = Date.now();
                });
            }
        });
    });

    function flushScrollAdjustment() {
        clearTimeout(momentumEndTimer);
        momentumEndTimer = undefined;
        // iOS fires scrollend on momentary pauses while the finger is still
        // down — flushing then writes the deferred adjustment straight into
        // the live gesture (observed as a jolt mid-drag). Re-defer until the
        // touch actually ends.
        if (isTouching) {
            momentumEndTimer = setTimeout(flushScrollAdjustment, 100);
            return;
        }
        isMomentumScrolling = false;
        if (!viewport) return;
        settleSpacerDebt();
        if (pendingScrollAdjustment !== 0 || pendingSnapToBottom) {
            vclDebug.log("flush", {
                adj: Math.round(pendingScrollAdjustment),
                snap: pendingSnapToBottom,
            });
        }
        if (pendingSnapToBottom) {
            pendingSnapToBottom = false;
            viewport.scrollTo({ top: 0 });
            lastProgrammaticScrollTime = Date.now();
        } else if (pendingScrollAdjustment !== 0) {
            viewport.scrollTop -= pendingScrollAdjustment;
            lastProgrammaticScrollTime = Date.now();
        }
        pendingScrollAdjustment = 0;
    }

    function adjustScrollTop(delta: number) {
        vclDebug.log("comp", {
            delta: Math.round(delta),
            deferred: isTouching || isMomentumScrolling,
        });
        if (isTouching || isMomentumScrolling) {
            pendingScrollAdjustment += delta;
        } else if (viewport) {
            viewport.scrollTop -= delta;
            lastProgrammaticScrollTime = Date.now();
        }
    }

    // ── _doScrollToIndex ───────────────────────────────────────────────────
    // Positions the viewport to center the item at `flatIndex`. Snapshots
    // spacerAvgHeight first so that getHeight, computeWindow, and
    // computeSpacers all use the same estimate for this navigation.
    // Uses prefix sums for O(1) distance calculation.
    function _doScrollToIndex(
        flatIndex: number,
        behavior: "auto" | "instant" | "smooth" = "instant",
    ) {
        if (!viewport) return;
        cancelGlide();
        // Re-freeze the estimate space BEFORE computing distance so getHeight,
        // computeWindow, and computeSpacers all use the same estimates.
        refreshEstimateSnapshot();
        ensurePrefixSums();
        // startPos(flatIndex) = prefix[flatIndex] + flatIndex * gap
        const distFromBottom = prefixSums[flatIndex] + flatIndex * gapPx;
        const itemH = getHeight(flatIndex);
        const offset = Math.max(0, distFromBottom + itemH / 2 - viewportHeight / 2);
        vclDebug.log("scroll-idx", {
            i: flatIndex,
            offset: Math.round(offset),
            corrections: scrollCorrectCount,
        });
        fromBottom = offset;
        updateWindowFull("scroll-to-index");
        lastProgrammaticScrollTime = Date.now();
        viewport.scrollTo({ top: -offset, behavior });

        // The offset above is estimate-based; in chats with high height
        // variance it can be way off (2x observed), producing a visible
        // multi-jump as the debounced corrections converge — or an off-target
        // landing when they run out. The target row is usually rendered after
        // the window update though, so refine against its actual rect: one
        // exact write that makes the estimate error invisible.
        if (behavior !== "smooth") {
            refineToIndex(flatIndex);
        }
    }

    // Centre the target row's actual rect (DOM truth, no estimates). Used
    // after every estimate-based positioning AND once more when the
    // corrective-scroll rounds run out — measures arriving after the last
    // correction would otherwise leave the landing off by their delta.
    function refineToIndex(flatIndex: number) {
        const key = items[flatIndex]?.key;
        tick().then(() => {
            if (!viewport || key === undefined || items[flatIndex]?.key !== key) return;
            const row = rowByKey(viewport, key);
            if (!row) return;
            const rowRect = row.getBoundingClientRect();
            const vpRect = viewport.getBoundingClientRect();
            const delta = rowRect.top + rowRect.height / 2 - (vpRect.top + vpRect.height / 2);
            if (Math.abs(delta) > 4) {
                vclDebug.log("scroll-idx-refine", { i: flatIndex, delta: Math.round(delta) });
                lastProgrammaticScrollTime = Date.now();
                viewport.scrollTop += delta;
                fromBottom = clampFromBottom(-viewport.scrollTop);
                // Don't rely on the resulting scroll event to resync the
                // window (iOS can swallow it after a programmatic write) —
                // a large refinement would otherwise leave the rendered
                // window at the pre-refine offset.
                updateWindowIncremental();
            }
        });
    }

    // ── measureRow (Svelte action) ─────────────────────────────────────────
    // Attached to each rendered row via `use:measureRow={absIdx}`. Measures
    // the element's height both synchronously on creation and asynchronously
    // via ResizeObserver for subsequent resizes (e.g. image loads).
    //
    // Key responsibilities:
    //   1. Update heightMap, keyToHeight, averageHeight when height changes.
    //   2. Compensate scrollTop when a newly-entered item's actual height
    //      differs from the estimate used to shrink the bottom spacer.
    //   3. Compensate scrollTop when an already-measured item in the bottom
    //      half of the window resizes (e.g. image load).
    //   4. Schedule corrective re-scrolls for scrollToIndex after measurements
    //      settle (debounced 100ms).
    //
    // The `update(newIdx)` return allows Svelte to keep currentIdx in sync
    // when items are prepended and all indices shift.
    function measureRow(node: HTMLElement, absIdx: number) {
        let currentIdx = absIdx;
        // Rows whose content renders in two passes (media height styles are
        // applied in onMount, after the first layout) briefly collapse on
        // every remount, churning a correction pair per window re-entry. The
        // settled height from the row's previous life is known — pin it as
        // min-height across the mount so the transient never reaches layout,
        // then release. Content that genuinely changed while unmounted
        // corrects normally after the release.
        const known = keyToHeight.get(items[absIdx]?.key ?? "");
        if (known !== undefined && known > 0) {
            node.style.minHeight = `${known}px`;
            requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                    node.style.minHeight = "";
                }),
            );
        }
        function measure() {
            // Guard: items may have shrunk (chat switch, teardown) while
            // this ResizeObserver callback was pending.
            if (currentIdx >= items.length || !items[currentIdx]) return;

            const h = node.offsetHeight;
            if (h > 0) {
                const prev = heightMap[currentIdx] ?? 0;
                if (prev !== h) {
                    // Update height tracking
                    if (prev > 0) {
                        totalMeasuredHeight -= prev;
                        measuredCount--;
                    }
                    heightMap[currentIdx] = h;
                    keyToHeight.set(items[currentIdx].key, h);
                    totalMeasuredHeight += h;
                    measuredCount++;
                    if (measuredCount > 0) averageHeight = totalMeasuredHeight / measuredCount;
                    trackClassMeasure(currentIdx, prev, h);

                    // Mark prefix sums for lazy rebuild rather than updating
                    // incrementally. During initial render or resize bursts,
                    // many items measure in the same frame — one O(N) rebuild
                    // in ensurePrefixSums() is much cheaper than O(N-i) per
                    // measurement (which totals O(windowSize × N) for the burst).
                    // The rebuild runs lazily: it only fires when the next
                    // computeWindow/computeSpacers call actually needs prefix sums.
                    prefixDirty = true;

                    // ── scrollTop compensation ─────────────────────────────
                    // In column-reverse, the bottom spacer is at the scroll
                    // origin. When an item enters from it, the spacer shrank
                    // by `est` but the rendered element occupies `h` pixels.
                    // If h ≠ est, total content height changed by (h - est),
                    // shifting visible content. We adjust scrollTop by the
                    // same amount to neutralize the shift.
                    //
                    // IMPORTANT: we do NOT adjust the spacer itself — that
                    // would cause accumulated drift over many items. The spacer
                    // at `sum(getHeight(0..start-1))` is always correct.
                    //
                    // Skip compensation when at the bottom (fromBottom ≈ 0) —
                    // there's no scroll position to preserve and compensating
                    // would fight with scrollToBottom(). However, some browsers
                    // (e.g. Safari) shift scrollTop when column-reverse content
                    // grows despite overflow-anchor: none, so we snap back to
                    // the bottom in that case.
                    const atBottom = fromBottom < 10;
                    const est = pendingBottomCorrections.get(currentIdx);
                    if (est !== undefined ? h !== est : prev > 0) {
                        vclDebug.log("measure", {
                            i: currentIdx,
                            key: items[currentIdx].key,
                            prev: Math.round(prev),
                            est: est !== undefined ? Math.round(est) : undefined,
                            h,
                            atBottom,
                            mode: est !== undefined ? "entered" : "resized",
                        });
                    }
                    if (est !== undefined) {
                        if (h !== est) {
                            if (atBottom) {
                                // Defer snap-to-bottom: flushScrollAdjustment will
                                // perform it once momentum ends.
                                pendingScrollAdjustment = 0;
                                if (isTouching || isMomentumScrolling) {
                                    pendingSnapToBottom = true;
                                } else if (viewport) {
                                    viewport.scrollTo({ top: 0 });
                                    lastProgrammaticScrollTime = Date.now();
                                }
                            } else if (canAbsorbIntoSpacer(h - est)) {
                                absorbIntoSpacer(h - est);
                            } else {
                                adjustScrollTop(h - est);
                            }
                        }
                        pendingBottomCorrections.delete(currentIdx);
                    } else if (prev > 0 && viewport) {
                        // Compensate only when the resized row sits below the user's
                        // reading point (the viewport centre). The window midpoint is
                        // the wrong split: overscan puts most of the window below the
                        // viewport, so rows the user is actually reading would get
                        // fully compensated (over-shifting the view) while genuine
                        // below-viewport growth might not be compensated at all.
                        // heightMap[currentIdx] was updated above, so prefix sums
                        // reflect the new height.
                        ensurePrefixSums();
                        const centerOffset = fromBottom + viewportHeight / 2;
                        // endPos(i) = prefix[i+1] + i * gap — the row's top edge,
                        // measured from the visual bottom
                        const rowEnd = prefixSums[currentIdx + 1] + currentIdx * gapPx;
                        if (rowEnd <= centerOffset) {
                            if (atBottom) {
                                pendingScrollAdjustment = 0;
                                if (isTouching || isMomentumScrolling) {
                                    pendingSnapToBottom = true;
                                } else {
                                    viewport.scrollTo({ top: 0 });
                                    lastProgrammaticScrollTime = Date.now();
                                }
                            } else if (
                                (isTouching || isMomentumScrolling) &&
                                canAbsorbIntoSpacer(h - prev)
                            ) {
                                // Mid-touch/momentum a scrollTop write is not an
                                // option (it kills native physics) and the
                                // deferred adjustment is flushed later as a
                                // visible double-jolt (grow-shift, then the
                                // correction jerking it back). A one-frame-late
                                // spacer absorb is the least bad option here.
                                absorbIntoSpacer(h - prev);
                            } else {
                                // NOTE: outside a touch gesture, do NOT absorb
                                // this into the spacer. A ResizeObserver-driven
                                // resize has already been laid out (and possibly
                                // painted) by the time we hear about it, so a
                                // spacer adjustment lands a frame late and shows
                                // as a visible bounce on a wheel glide. The
                                // immediate scrollTop write is the lesser evil —
                                // these resizes (images/settling content) are far
                                // rarer than entries during a scroll.
                                adjustScrollTop(h - prev);
                            }
                        }
                    }

                    // If this item is at or below the scroll target, the cumulative height
                    // used to position the target has changed. Schedule a corrective re-scroll
                    // once measurements settle (debounced).
                    if (
                        pendingScrollFlatIdx !== undefined &&
                        Date.now() - pendingScrollStartedAt > SCROLL_CORRECTION_TTL_MS
                    ) {
                        clearTimeout(scrollCorrectTimer);
                        pendingScrollFlatIdx = undefined;
                        scrollCorrectCount = 0;
                    }
                    if (pendingScrollFlatIdx !== undefined && currentIdx <= pendingScrollFlatIdx) {
                        clearTimeout(scrollCorrectTimer);
                        scrollCorrectTimer = window.setTimeout(() => {
                            if (
                                pendingScrollFlatIdx !== undefined &&
                                scrollCorrectCount < MAX_SCROLL_CORRECTIONS
                            ) {
                                scrollCorrectCount++;
                                _doScrollToIndex(pendingScrollFlatIdx, "instant");
                            } else {
                                // Out of correction rounds: nudge onto the
                                // target's actual rect one final time, so
                                // measures that arrived after the last round
                                // can't leave the landing off-screen.
                                if (pendingScrollFlatIdx !== undefined) {
                                    refineToIndex(pendingScrollFlatIdx);
                                }
                                pendingScrollFlatIdx = undefined;
                                scrollCorrectCount = 0;
                            }
                        }, 100);
                    }
                }
            }
        }

        // Synchronous initial measurement: forces layout to get the actual height
        // immediately, so the scrollTop compensation happens in the same frame as
        // the item entry — preventing a visible shift during forward scroll.
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(node);

        return {
            update(newIdx: number) {
                currentIdx = newIdx;
            },
            destroy() {
                ro.disconnect();
            },
        };
    }

    // ── Sticky date ───────────────────────────────────────────────────────
    // dateMarkerCache holds each date row's bounding rectangle top at
    // cache-build time, plus the oldest rendered item as a fallback.
    // Sorted oldest→newest (ascending top). Rebuilt after each full window
    // update via tick(). onScroll applies a scrollTop delta and scans the
    // tiny array — no DOM queries on the hot path.
    type DateMarker = { top: number; ts: bigint; isDateRow: boolean };
    let dateMarkerCache: DateMarker[] = [];
    let dateMarkerCacheScrollTop = 0;
    // While an inline date row is passing directly under the floating date's
    // position, the same date would briefly render twice — suppress the
    // floating copy for the height of the hand-off band.
    const STICKY_DATE_HANDOFF_PX = 32;

    function rebuildDateMarkerCache() {
        if (!viewport || isDateMarker === undefined || timestampFor === undefined) return;
        const rows = viewport.querySelectorAll<HTMLElement>(".vcl-row");
        const markers: DateMarker[] = [];
        // DOM order: rows[0] = newest (bottom), rows[last] = oldest (top).
        // Iterate last→first so markers are pushed in ascending top order (oldest first).
        for (let i = rows.length - 1; i >= 0; i--) {
            const item = items[start + i];
            if (item === undefined) continue;
            const isDateRow = isDateMarker(item);
            const isOldest = i === rows.length - 1;
            if (isOldest || isDateRow) {
                const ts = timestampFor(item);
                if (ts !== undefined) {
                    markers.push({ top: rows[i].getBoundingClientRect().top, ts, isDateRow });
                }
            }
        }
        dateMarkerCache = markers;
        dateMarkerCacheScrollTop = viewport.scrollTop;
        updateStickyDate();
    }

    function updateStickyDate() {
        if (!viewport || stickyDateElTop === undefined) return;
        // Rows have moved by (currentScrollTop - cacheScrollTop) since the cache
        // was built. Apply the delta so we don't need to rebuild on every scroll.
        const scrollDelta = viewport.scrollTop - dateMarkerCacheScrollTop;
        let result: DateMarker | undefined = undefined;
        for (const marker of dateMarkerCache) {
            if (marker.top - scrollDelta <= stickyDateElTop) result = marker;
            else break;
        }
        // Hand-off: if the winning marker is an actual inline date row still
        // sitting at the floating date's position, let the inline row be the
        // label rather than showing the same date twice.
        if (
            result !== undefined &&
            result.isDateRow &&
            result.top - scrollDelta > stickyDateElTop - STICKY_DATE_HANDOFF_PX
        ) {
            stickyDateTimestamp = undefined;
            return;
        }
        stickyDateTimestamp = result?.ts;
    }

    // Fired on every scroll event. Updates fromBottom, runs incremental
    // window update, notifies the owner (for message loading), and
    // cancels any pending corrective scroll if this was a genuine user scroll.
    let prevScrollEventTop = 0;
    let prevScrollEventTime = 0;
    function onScroll() {
        if (!viewport || interrupt) return;
        lastScrollEventTime = Date.now();
        if (vclDebug.enabled) {
            const st = viewport.scrollTop;
            const delta = st - prevScrollEventTop;
            const now = Date.now();
            const staleSample = now - prevScrollEventTime > 500;
            prevScrollEventTime = now;
            // A large scrollTop discontinuity not caused by our own writes is
            // exactly the "jumping around" symptom — flag it with full context.
            // Ignore stale samples (first event after a pause/chat switch — the
            // previous position is from another world, not a jump).
            if (!staleSample && Math.abs(delta) > 400 && now - lastProgrammaticScrollTime > 150) {
                vclDebug.log("!jump", {
                    from: Math.round(prevScrollEventTop),
                    to: Math.round(st),
                    delta: Math.round(delta),
                    s: start,
                    e: end,
                    bh: Math.round(bottomSpacerHeight),
                    th: Math.round(topSpacerHeight),
                });
            }
            prevScrollEventTop = st;
        }
        fromBottom = clampFromBottom(-viewport.scrollTop);

        // Each scroll event proves momentum is still active; push the idle
        // timer forward so flushScrollAdjustment only fires once truly idle.
        if (isMomentumScrolling) {
            clearTimeout(momentumEndTimer);
            momentumEndTimer = setTimeout(flushScrollAdjustment, 100);
        }

        // Track genuine user scrolling — the window in which measurement
        // compensations are absorbed into the spacer instead of scrollTop.
        if (Date.now() - lastProgrammaticScrollTime > 100) {
            lastUserScrollTime = Date.now();
            // velocity sample for synthetic momentum continuation
            const nowP = performance.now();
            const top = viewport.scrollTop;
            if (nowP - sampleTime < 200 && nowP > sampleTime) {
                sampledVelocity = (top - sampleTop) / (nowP - sampleTime);
            }
            sampleTime = nowP;
            sampleTop = top;
        }
        if (spacerDebt !== 0) {
            clearTimeout(debtIdleTimer);
            debtIdleTimer = setTimeout(settleSpacerDebt, 150);
        }

        updateWindowIncremental();
        updateStickyDate();
        onUserScroll?.(Date.now() - lastProgrammaticScrollTime > 100);

        // Cancel corrective scroll on genuine user scrolls.
        if (pendingScrollFlatIdx !== undefined && Date.now() - lastProgrammaticScrollTime > 50) {
            clearTimeout(scrollCorrectTimer);
            pendingScrollFlatIdx = undefined;
        }
    }

    export function scrollToIndex(
        flatIndex: number,
        behavior: "auto" | "instant" | "smooth" = "instant",
    ) {
        clearTimeout(scrollCorrectTimer);
        pendingScrollFlatIdx = flatIndex;
        scrollCorrectCount = 0;
        pendingScrollStartedAt = Date.now();
        _doScrollToIndex(flatIndex, behavior);
    }

    // The owner performs some scrollTop writes of its own (the loadNew
    // restore, the interrupt restore). They must be marked as programmatic or
    // their scroll events read as genuine user scrolls: logged as !jump,
    // releasing the bottom pin, and updating the user-scroll clock that debt
    // absorption keys off.
    export function markProgrammaticScroll() {
        lastProgrammaticScrollTime = Date.now();
    }

    // The scrollTop the last prepend was pinned to by the same-flush anchor
    // write. The owner's post-load restore must target THIS — its own anchor
    // rect was captured before the load await, so restoring to it rewinds the
    // user by however far they scrolled while the load was in flight (~700px
    // per boundary on a cold cache; imperceptible on a warm one — which is
    // why the boundary feel varied so wildly between sessions).
    let lastPrependPinTarget: number | undefined;
    export function lastPrependPin(): number | undefined {
        return lastPrependPinTarget;
    }

    export function scrollToBottom(behavior: "auto" | "instant" | "smooth" = "instant") {
        cancelGlide();
        clearTimeout(scrollCorrectTimer);
        scrollCorrectTimer = undefined;
        pendingScrollFlatIdx = undefined;
        scrollCorrectCount = 0;
        lastProgrammaticScrollTime = Date.now();
        // Deterministically render the bottom window instead of waiting for the
        // scrollTo below to emit a scroll event. On iOS that event may never fire
        // (e.g. scrollTop is already 0 in a stale/empty-window state), so the
        // onScroll resync never runs and the list would stay blank.
        fromBottom = 0;
        updateWindowFull("scroll-to-bottom");
        viewport?.scrollTo({ top: 0, behavior });
    }

    onMount(() => {
        const el = viewport!;
        gapPx = parseFloat(getComputedStyle(el).rowGap) || 0;
        el.addEventListener("scroll", onScroll);

        const onTouchStart = () => {
            isTouching = true;
            isMomentumScrolling = false;
            // the finger takes over from any synthetic glide
            cancelGlide();
            clearTimeout(momentumEndTimer);
            momentumEndTimer = undefined;
            onUserTouch?.();
        };
        const onTouchEnd = () => {
            isTouching = false;
            isMomentumScrolling = true;
            // Fallback for browsers without scrollend: if no scroll events arrive
            // within 50 ms the flick had no momentum, so flush immediately.
            // If scroll events do arrive, onScroll resets this timer on each one
            // so the flush only fires once the scroll truly goes idle.
            momentumEndTimer = setTimeout(flushScrollAdjustment, 50);
        };
        const onTouchCancel = () => {
            isTouching = false;
            isMomentumScrolling = true;
            momentumEndTimer = setTimeout(flushScrollAdjustment, 50);
        };
        const onScrollEnd = () => flushScrollAdjustment();

        if (mobileOperatingSystem === "iOS") {
            el.addEventListener("touchstart", onTouchStart, { passive: true });
            el.addEventListener("touchend", onTouchEnd, { passive: true });
            el.addEventListener("touchcancel", onTouchCancel, { passive: true });
        }
        el.addEventListener("scrollend", onScrollEnd, { passive: true });

        const ro = new ResizeObserver(() => {
            viewportHeight = el.clientHeight;
            updateWindowFull("viewport-resize");
        });
        ro.observe(el);
        viewportHeight = el.clientHeight;

        updateWindowFull("mount");

        // The frame watcher forces a layout per frame (getBoundingClientRect
        // per row) — invaluable for catching shifts, but it turns any
        // pathologically slow layout into a per-frame death spiral. Opt-in
        // separately from vcl_debug, and it disarms itself if sampling gets
        // expensive.
        let watch = false;
        try {
            watch = vclDebug.enabled && localStorage.getItem("vcl_watch") === "1";
        } catch {
            // ignore
        }
        const stopFrameWatcher = watch ? startFrameWatcher(el) : undefined;

        return () => {
            el.removeEventListener("scroll", onScroll);
            if (mobileOperatingSystem === "iOS") {
                el.removeEventListener("touchstart", onTouchStart);
                el.removeEventListener("touchend", onTouchEnd);
                el.removeEventListener("touchcancel", onTouchCancel);
            }
            el.removeEventListener("scrollend", onScrollEnd);
            cancelGlide();
            clearTimeout(momentumEndTimer);
            clearTimeout(debtIdleTimer);
            ro.disconnect();
            clearTimeout(scrollCorrectTimer);
            scrollCorrectTimer = undefined;
            pendingScrollFlatIdx = undefined;
            stopFrameWatcher?.();
        };
    });

    // ── Frame watcher (diagnostics only) ──────────────────────────────────
    // Samples every rendered row's viewport-relative position each frame.
    // For a row present in consecutive frames, its position change must equal
    // -(scrollTop change); any residual means content shifted under the user's
    // scroll position — the visible "glitch" this exists to catch. Shifts
    // during an interrupt frame are expected (window replacement under
    // overflow: hidden) and tagged accordingly.
    function startFrameWatcher(el: HTMLDivElement): () => void {
        let rafId: number;
        let prevSt = el.scrollTop;
        let prevTops = new Map<string, number>();
        let lastSnap = 0;
        const frame = () => {
            const t0 = performance.now();
            const st = el.scrollTop;
            const vpTop = el.getBoundingClientRect().top;
            const rows = el.querySelectorAll<HTMLElement>(".vcl-row");
            const tops = new Map<string, number>();
            rows.forEach((r) => {
                const k = r.dataset.key;
                if (k !== undefined) tops.set(k, r.getBoundingClientRect().top - vpTop);
            });
            const dSt = st - prevSt;
            for (const [k, top] of tops) {
                const pt = prevTops.get(k);
                if (pt === undefined) continue;
                const residual = top - pt + dSt;
                // tolerance scales with scroll speed: sub-pixel row positions
                // accumulate real rounding error on fast multi-thousand-px frames.
                // Shifts during interrupt frames are expected window replacements —
                // log them without the anomaly tag.
                if (Math.abs(residual) > Math.max(4, 0.01 * Math.abs(dSt))) {
                    vclDebug.log(interrupt ? "shift-interrupt" : "!content-shift", {
                        key: k,
                        dTop: Math.round(top - pt),
                        dSt: Math.round(dSt),
                        residual: Math.round(residual),
                        st: Math.round(st),
                        fb: Math.round(fromBottom),
                        interrupt,
                        s: start,
                        e: end,
                        bh: Math.round(bottomSpacerHeight),
                        th: Math.round(topSpacerHeight),
                    });
                    break; // one row per frame is enough to flag the shift
                }
            }
            const now = performance.now();
            if (now - lastSnap > 1000) {
                lastSnap = now;
                vclDebug.log("snap", {
                    st: Math.round(st),
                    fb: Math.round(fromBottom),
                    s: start,
                    e: end,
                    bh: Math.round(bottomSpacerHeight),
                    th: Math.round(topSpacerHeight),
                    n: items.length,
                    avg: Math.round(spacerAvgHeight),
                    measured: measuredCount,
                });
            }
            prevSt = st;
            prevTops = tops;
            // self-limiting: if forcing layout takes this long, sampling per
            // frame would grind the tab to death — stop watching.
            if (performance.now() - t0 > 40) {
                vclDebug.log("!watcher-disarmed", { ms: Math.round(performance.now() - t0) });
                return;
            }
            rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(rafId);
    }

    let visibleItems = $derived(items.slice(start, end));
</script>

<div
    class={`vcl-viewport ${viewportClass ?? ""}`}
    class:interrupt
    {id}
    bind:this={viewport}>
    {#if bottomSpacerHeight > 0}
        <div class="vcl-spacer" style:height="{bottomSpacerHeight}px"></div>
    {/if}
    {#each visibleItems as item, relIdx (item.key)}
        {@const absIdx = start + relIdx}
        <div class="vcl-row" data-key={item.key} use:measureRow={absIdx}>
            <!-- a row that throws during render must not take the whole list down
                 with it — an aborted flush leaves the DOM permanently out of sync
                 with the window state -->
            <svelte:boundary
                onerror={(e) =>
                    vclDebug.log("!row-render-error", {
                        key: item.key,
                        err: String(e).slice(0, 200),
                    })}>
                {@render row(item, absIdx)}
                {#snippet failed()}
                    <div class="vcl-row-error"></div>
                {/snippet}
            </svelte:boundary>
        </div>
    {/each}
    {#if topSpacerHeight > 0}
        <div class="vcl-spacer" style:height="{topSpacerHeight}px"></div>
    {/if}
</div>

<style lang="scss">
    .vcl-viewport {
        display: flex;
        flex-direction: column-reverse;
        overflow-y: auto;
        overflow-x: hidden;
        overflow-anchor: none;
        overscroll-behavior: contain;
        // sizing (flex/height) is deliberately left to the caller via
        // viewportClass — the viewport must be constrained by its parent for
        // virtualisation to work at all
        box-sizing: border-box;

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .vcl-spacer {
        flex-shrink: 0;
        width: 100%;
    }

    .vcl-row-error {
        height: 8px;
    }

    .vcl-row {
        width: 100%;
        flex-shrink: 0;
        // A flex formatting context stops child margins collapsing out of the
        // row, so offsetHeight (which drives all spacer math) includes them.
        display: flex;
        flex-direction: column;
    }
</style>
