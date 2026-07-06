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
    } from "./virtualListUtils";

    let {
        items,
        interrupt,
        fromBottom = $bindable(0),
        row,
        onUserScroll,
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

    // Full rebuild of heightMap and prune keyToHeight to only keys present in
    // the current items (prevents unbounded growth when items are replaced,
    // e.g. navigating to a different event window).
    function rebuildHeightMap() {
        heightMap = new Array(items.length).fill(0);
        totalMeasuredHeight = 0;
        measuredCount = 0;
        const prunedHeights = new Map<string, number>();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const h = keyToHeight.get(item.key);
            if (h !== undefined && h > 0) {
                heightMap[i] = h;
                prunedHeights.set(item.key, h);
                totalMeasuredHeight += h;
                measuredCount++;
            }
        }
        keyToHeight = prunedHeights;
        if (measuredCount > 0) averageHeight = totalMeasuredHeight / measuredCount;
        prefixDirty = true;
    }

    // Incremental extension for append-only changes (older messages loaded at
    // the end). O(numNew) instead of O(N) — reuses existing heightMap entries
    // for indices 0..fromIdx-1 without recomputing.
    function extendHeightMap(fromIdx: number) {
        heightMap.length = items.length;
        for (let i = fromIdx; i < items.length; i++) {
            const item = items[i];
            const h = keyToHeight.get(item.key);
            if (h !== undefined && h > 0) {
                heightMap[i] = h;
                totalMeasuredHeight += h;
                measuredCount++;
            } else {
                heightMap[i] = 0;
            }
        }
        if (measuredCount > 0) averageHeight = totalMeasuredHeight / measuredCount;
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
        prefixSums = buildPrefixSums(items.length, heightMap, spacerAvgHeight);
        prefixDirty = false;
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

    // Use spacerAvgHeight (snapshot) for ALL unmeasured item estimates.
    // This keeps computeWindow and spacer calculations consistent — prevents
    // oscillation when averageHeight drifts from spacerAvgHeight during measurements.
    function getHeight(i: number): number {
        return heightMap[i] > 0 ? heightMap[i] : spacerAvgHeight;
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

    // Full recompute: used on init, navigation, items change, resize.
    function updateWindowFull(reason: string = "unknown") {
        // Only mark prefix sums dirty if spacerAvgHeight actually changed,
        // to avoid redundant O(N) rebuilds when callers (e.g. _doScrollToIndex)
        // have already set spacerAvgHeight and rebuilt prefix sums.
        if (spacerAvgHeight !== averageHeight) {
            spacerAvgHeight = averageHeight;
            prefixDirty = true;
        }
        const [s, e] = computeWindow();
        let [bh, th] = computeSpacers(s, e);
        [bh, th] = sanitizeSpacers(bh, th);
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
        // the canonical spacer assignment above wipes out any DOM-side debt
        spacerDebt = 0;
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
        const [s, e] = computeWindow();

        if (s === start && e === end) return;

        // For large window shifts (drag-scroll, PageUp, programmatic jumps),
        // the incremental bottom spacer loop becomes O(|s-start|) which can
        // be large. Fall back to a full recompute — the visual position is
        // being reset anyway so pendingBottomCorrections don't matter.
        const INCREMENTAL_THRESHOLD = 50;
        if (Math.abs(s - start) > INCREMENTAL_THRESHOLD) {
            const [bh, th] = computeSpacers(s, e);
            vclDebug.log("incr-jumped", { s, e, bh: Math.round(bh), th: Math.round(th) });
            start = s;
            end = e;
            bottomSpacerHeight = bh;
            topSpacerHeight = th;
            spacerDebt = 0;
            pendingBottomCorrections.clear();
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
            vclDebug.log("!negative-spacer", { bh: Math.round(bottomSpacerHeight), s, e });
        }
        bottomSpacerHeight = Math.max(0, bottomSpacerHeight);
        [bottomSpacerHeight, topSpacerHeight] = sanitizeSpacers(bottomSpacerHeight, topSpacerHeight);

        vclDebug.log("incr", {
            s,
            e,
            bh: Math.round(bottomSpacerHeight),
            th: Math.round(topSpacerHeight),
            pend: pendingBottomCorrections.size,
        });

        start = s;
        end = e;
        tick().then(rebuildDateMarkerCache);
    }


    // After interrupt ends (scroll restored), sync fromBottom and do a full recompute
    // so spacer state is consistent with the restored scroll position.
    $effect(() => {
        if (!interrupt && viewport) {
            untrack(() => {
                vclDebug.log("interrupt-end", { st: Math.round(viewport!.scrollTop) });
                settleSpacerDebt();
                fromBottom = clampFromBottom(-viewport!.scrollTop);
                updateWindowFull("interrupt-end");
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
    let lastUserScrollTime = 0;
    let debtIdleTimer: ReturnType<typeof setTimeout> | undefined;
    const MAX_SPACER_DEBT = 400;

    function canAbsorbIntoSpacer(delta: number): boolean {
        // Absorption is a pure layout change (spacer and entering row commit in
        // the same flush, net zero height) with no scrollTop write, so it is
        // safe — and essential — during touch/momentum scrolling too: without
        // it every entering item's estimate error shifts the content
        // mid-gesture (observed on iOS as per-message 'vibration' when
        // scrolling forward through unmeasured history).
        const scrolling =
            isTouching || isMomentumScrolling || Date.now() - lastUserScrollTime < 200;
        if (!scrolling || bottomSpacerHeight - delta < 0) {
            return false;
        }
        // A single correction bigger than the cap (a very tall item measured
        // against the average estimate) must go straight to the scroll
        // adjustment path — if we absorbed it we would immediately be forced
        // to repay it mid-scroll.
        if (Math.abs(delta) >= MAX_SPACER_DEBT) {
            return false;
        }
        // On a long sustained scroll the debt never gets an idle moment to be
        // repaid; once the cap would be exceeded, force a single repayment
        // write rather than degrading to a write per entering item. Except
        // during touch/momentum, where a settle write would kill the native
        // physics — fall through to the deferred-adjustment path instead.
        if (Math.abs(spacerDebt + delta) >= MAX_SPACER_DEBT) {
            if (isTouching || isMomentumScrolling) {
                return false;
            }
            settleSpacerDebt(true);
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
    function settleSpacerDebt(force = false) {
        clearTimeout(debtIdleTimer);
        debtIdleTimer = undefined;
        if (spacerDebt === 0 || !viewport) return;
        if (!force && (isTouching || isMomentumScrolling || Date.now() - lastUserScrollTime < 250)) {
            debtIdleTimer = setTimeout(() => settleSpacerDebt(), 300);
            return;
        }
        const debt = spacerDebt;
        spacerDebt = 0;
        // flushSync commits the spacer height to the DOM in this task, so the
        // spacer change and the scrollTop write land in the same layout.
        // Falls back to a plain (still pre-paint) write when called from
        // within an effect, where flushSync is not permitted.
        try {
            flushSync(() => {
                bottomSpacerHeight += debt;
            });
        } catch {
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
            // repay any spacer debt before deriving positions from scrollTop —
            // the full recompute below reinstates the canonical spacer height
            settleSpacerDebt();
            const oldLen = prevItemsLength;
            const oldFirstKey = prevFirstKey;
            const oldLastKey = prevLastKey;
            prevFirstKey = items[0]?.key;
            prevLastKey = items.length > 0 ? items[items.length - 1].key : undefined;
            prevItemsLength = items.length;

            const numNew = items.length - oldLen;

            // Detect prepend: items grew, first key changed, and the old first
            // item is now at index (newLen - oldLen) — i.e. it was shifted right.
            const isPrepend =
                numNew > 0 &&
                oldLen > 0 &&
                oldFirstKey !== undefined &&
                items[numNew]?.key === oldFirstKey;

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
                spacerAvgHeight = averageHeight;
                prefixDirty = true;
            }

            let prependOffset = 0;
            if (isPrepend) {
                // New items were prepended at the visual bottom (scroll origin
                // in column-reverse). Adjust fromBottom so updateWindowFull
                // targets the same visual position in the new index space.
                let offset = 0;
                for (let i = 0; i < numNew; i++) {
                    offset += getHeight(i);
                }
                // Include gaps: numNew new items add numNew gaps (one per item
                // plus the gap between last new item and old first item).
                offset += numNew * gapPx;
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
        });
    });

    function flushScrollAdjustment() {
        clearTimeout(momentumEndTimer);
        momentumEndTimer = undefined;
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
        // Snapshot averageHeight BEFORE computing distance so getHeight,
        // computeWindow, and computeSpacers all use the same estimate.
        spacerAvgHeight = averageHeight;
        prefixDirty = true; // spacerAvgHeight changed
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
            const key = items[flatIndex]?.key;
            tick().then(() => {
                if (!viewport || key === undefined || items[flatIndex]?.key !== key) return;
                const row = viewport.querySelector<HTMLElement>(
                    `.vcl-row[data-key="${CSS.escape(key)}"]`,
                );
                if (!row) return;
                const rowRect = row.getBoundingClientRect();
                const vpRect = viewport.getBoundingClientRect();
                const delta =
                    rowRect.top + rowRect.height / 2 - (vpRect.top + vpRect.height / 2);
                if (Math.abs(delta) > 4) {
                    vclDebug.log("scroll-idx-refine", { i: flatIndex, delta: Math.round(delta) });
                    lastProgrammaticScrollTime = Date.now();
                    viewport.scrollTop += delta;
                    fromBottom = clampFromBottom(-viewport.scrollTop);
                }
            });
        }
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
                            } else {
                                // NOTE: unlike the entry path above, do NOT absorb
                                // this into the spacer. A ResizeObserver-driven
                                // resize has already been laid out (and possibly
                                // painted) by the time we hear about it, so a
                                // spacer adjustment lands a frame late and shows
                                // as a visible bounce. The immediate scrollTop
                                // write is the lesser evil here — these resizes
                                // (images/settling content) are far rarer than
                                // entries during a scroll.
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
    type DateMarker = { top: number; ts: bigint };
    let dateMarkerCache: DateMarker[] = [];
    let dateMarkerCacheScrollTop = 0;

    function rebuildDateMarkerCache() {
        if (!viewport || isDateMarker === undefined || timestampFor === undefined) return;
        const rows = viewport.querySelectorAll<HTMLElement>(".vcl-row");
        const markers: DateMarker[] = [];
        // DOM order: rows[0] = newest (bottom), rows[last] = oldest (top).
        // Iterate last→first so markers are pushed in ascending top order (oldest first).
        for (let i = rows.length - 1; i >= 0; i--) {
            const item = items[start + i];
            if (item === undefined) continue;
            const isOldest = i === rows.length - 1;
            if (isOldest || isDateMarker(item)) {
                const ts = timestampFor(item);
                if (ts !== undefined) {
                    markers.push({ top: rows[i].getBoundingClientRect().top, ts });
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
        let result: bigint | undefined = undefined;
        for (const marker of dateMarkerCache) {
            if (marker.top - scrollDelta <= stickyDateElTop) result = marker.ts;
            else break;
        }
        stickyDateTimestamp = result;
    }

    // Fired on every scroll event. Updates fromBottom, runs incremental
    // window update, notifies the owner (for message loading), and
    // cancels any pending corrective scroll if this was a genuine user scroll.
    let prevScrollEventTop = 0;
    let prevScrollEventTime = 0;
    function onScroll() {
        if (!viewport || interrupt) return;
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

    export function scrollToBottom(behavior: "auto" | "instant" | "smooth" = "instant") {
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
            clearTimeout(momentumEndTimer);
            momentumEndTimer = undefined;
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
            settleSpacerDebt();
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
