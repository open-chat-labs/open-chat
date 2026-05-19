<script module lang="ts">
    export type TimelineItem = TimelineDate | TimelineEventGroup;
    export type TimelineDate = { kind: "timeline_date"; timestampSeconds: bigint };
    export type TimelineEventGroup = {
        kind: "timeline_event_group";
        group: EventWrapper<ChatEvent>[][];
    };

    export type FlatChatDate = { kind: "date"; key: string; timestamp: bigint };
    export type FlatChatEvent = {
        kind: "event";
        key: string;
        wrapper: EventWrapper<ChatEvent>;
        first: boolean;
        last: boolean;
    };
    export type FlatChatItem = FlatChatDate | FlatChatEvent;
</script>

<script lang="ts">
    /**
     * VirtualMessageList — a bi-directional infinite-scroll virtual list for chat
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
    import {
        messageContextsEqual,
        type ChatEvent,
        type EventWrapper,
        type MessageContext,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import {
        computeSpacers as _computeSpacers,
        computeWindow as _computeWindow,
        buildPrefixSums,
        OVERSCAN_PX,
    } from "../utils/virtualMessageListUtils";

    const MESSAGE_READ_THRESHOLD = 500;

    interface Props {
        messageContext: MessageContext;
        items: FlatChatItem[];
        interrupt: boolean;
        stickyDateTimestamp?: bigint;
        fromBottom?: number;
        itemView: Snippet<[FlatChatItem]>;
    }

    let {
        messageContext,
        items,
        interrupt,
        stickyDateTimestamp = $bindable(undefined),
        fromBottom = $bindable(0),
        itemView,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let viewport: HTMLDivElement;
    let viewportHeight = 0;
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
    //   timelineIndexToFlat — O(1) lookup from timelineIndex → flat array index
    //     for fast programmatic scrolling. Rebuilt when items change.
    //   dateIndices — sorted array of indices where items[i].kind === "date".
    //     Rebuilt when items change. Used by updateStickyDate for O(log D)
    //     binary search instead of O(daySize) linear scan.
    let heightMap: number[] = [];
    let prefixSums: number[] = [0];
    let prefixDirty = true;
    let keyToHeight = new SvelteMap<string, number>();
    let messageIndexToFlat = new SvelteMap<number, number>();
    let dateIndices: number[] = [];
    let totalMeasuredHeight = 0;
    let measuredCount = 0;
    let averageHeight = 95;

    // Full rebuild of heightMap, messageIndexToFlat, and prune keyToHeight
    // to only keys present in the current items (prevents unbounded growth
    // when items are replaced, e.g. navigating to a different event window).
    function rebuildHeightMap() {
        heightMap = new Array(items.length).fill(0);
        totalMeasuredHeight = 0;
        measuredCount = 0;
        messageIndexToFlat = new SvelteMap();
        dateIndices = [];
        const prunedHeights = new SvelteMap<string, number>();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const h = keyToHeight.get(item.key);
            if (h !== undefined && h > 0) {
                heightMap[i] = h;
                prunedHeights.set(item.key, h);
                totalMeasuredHeight += h;
                measuredCount++;
            }
            if (item.kind === "event" && item.wrapper.event.kind === "message") {
                messageIndexToFlat.set(item.wrapper.event.messageIndex, i);
            } else if (item.kind === "date") {
                dateIndices.push(i);
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
            if (item.kind === "event" && item.wrapper.event.kind === "message") {
                messageIndexToFlat.set(item.wrapper.event.messageIndex, i);
            } else if (item.kind === "date") {
                dateIndices.push(i);
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
    let pendingBottomCorrections = new SvelteMap<number, number>();

    // Read receipt tracking
    let messageObserver = $state<IntersectionObserver | undefined>();
    let messageReadTimers = new SvelteMap<number, number>();

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

    // Find the sticky date by computing the item at the viewport top (without
    // overscan) using prefix sums, then binary-searching dateIndices for the
    // nearest date marker at or above that position. O(log N + log D) where
    // D is the number of date markers, instead of O(daySize) linear scan.
    function updateStickyDate() {
        if (dateIndices.length === 0) {
            stickyDateTimestamp = undefined;
            return;
        }
        ensurePrefixSums();
        const topEdge = fromBottom + viewportHeight;

        // Binary search for the first item whose startPos exceeds topEdge.
        let lo = start,
            hi = end;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (prefixSums[mid] + mid * gapPx > topEdge) hi = mid;
            else lo = mid + 1;
        }
        const topIdx = Math.min(lo, items.length - 1);

        // Binary search dateIndices for the first date marker at or above topIdx.
        // dateIndices is sorted ascending; we want the first entry >= topIdx.
        lo = 0;
        hi = dateIndices.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (dateIndices[mid] < topIdx) lo = mid + 1;
            else hi = mid;
        }

        if (lo < dateIndices.length) {
            const dateItem = items[dateIndices[lo]];
            if (dateItem?.kind === "date") {
                stickyDateTimestamp = (dateItem as { kind: "date"; timestampSeconds: bigint })
                    .timestampSeconds;
                return;
            }
        }
        stickyDateTimestamp = undefined;
    }

    // Full recompute: used on init, navigation, items change, resize.
    function updateWindowFull() {
        // Only mark prefix sums dirty if spacerAvgHeight actually changed,
        // to avoid redundant O(N) rebuilds when callers (e.g. _doScrollToIndex)
        // have already set spacerAvgHeight and rebuilt prefix sums.
        if (spacerAvgHeight !== averageHeight) {
            spacerAvgHeight = averageHeight;
            prefixDirty = true;
        }
        const [s, e] = computeWindow();
        const [bh, th] = computeSpacers(s, e);
        start = s;
        end = e;
        bottomSpacerHeight = bh;
        topSpacerHeight = th;
        pendingBottomCorrections.clear();
        updateStickyDate();
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

        // For large window shifts (drag-scroll, PageUp, programmatic jumps),
        // the incremental bottom spacer loop becomes O(|s-start|) which can
        // be large. Fall back to a full recompute — the visual position is
        // being reset anyway so pendingBottomCorrections don't matter.
        const INCREMENTAL_THRESHOLD = 50;
        if (Math.abs(s - start) > INCREMENTAL_THRESHOLD) {
            const [bh, th] = computeSpacers(s, e);
            start = s;
            end = e;
            bottomSpacerHeight = bh;
            topSpacerHeight = th;
            pendingBottomCorrections.clear();
            updateStickyDate();
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

        bottomSpacerHeight = Math.max(0, bottomSpacerHeight);

        start = s;
        end = e;
        updateStickyDate();
    }

    // Track previous items to detect prepend vs append vs replacement.
    let prevFirstKey: string | undefined;
    let prevLastKey: string | undefined;
    let prevItemsLength = 0;

    // Recompute the virtual window whenever items change.
    $effect(() => {
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
            // oldest — in that case flattenForVirtualList may insert/move items
            // within the existing range, so a full rebuild is needed.
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
            }

            updateWindowFull();
        });
    });

    // After interrupt ends (scroll restored), sync fromBottom and do a full recompute
    // so spacer state is consistent with the restored scroll position.
    $effect(() => {
        if (!interrupt && viewport) {
            untrack(() => {
                fromBottom = -viewport.scrollTop;
                updateWindowFull();
            });
        }
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
    const MAX_SCROLL_CORRECTIONS = 3;

    // Timestamp of last programmatic scrollTop change. Used to distinguish
    // programmatic scrolls (corrections, scrollToIndex, measureRow compensation)
    // from genuine user scrolls. Prevents the corrective scroll from being
    // cancelled by scroll events we ourselves triggered.
    let lastProgrammaticScrollTime = 0;

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
        fromBottom = offset;
        updateWindowFull();
        lastProgrammaticScrollTime = Date.now();
        viewport.scrollTo({ top: -offset, behavior });
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
                    // would fight with scrollBottom(). However, some browsers
                    // (e.g. Safari) shift scrollTop when column-reverse content
                    // grows despite overflow-anchor: none, so we snap back to
                    // the bottom in that case.
                    const atBottom = fromBottom < 10;
                    const est = pendingBottomCorrections.get(currentIdx);
                    if (est !== undefined) {
                        if (viewport && h !== est) {
                            if (atBottom) {
                                viewport.scrollTo({ top: 0 });
                            } else {
                                viewport.scrollTop -= h - est;
                            }
                            lastProgrammaticScrollTime = Date.now();
                        }
                        pendingBottomCorrections.delete(currentIdx);
                    } else if (prev > 0 && viewport) {
                        // Subsequent resize of an already-measured item (e.g.
                        // image load). Only compensate for items in the bottom
                        // half of the window — items near the top don't shift
                        // visible content in column-reverse.
                        const mid = start + Math.floor((end - start) / 2);
                        if (currentIdx < mid) {
                            if (atBottom) {
                                viewport.scrollTo({ top: 0 });
                            } else {
                                viewport.scrollTop -= h - prev;
                            }
                            lastProgrammaticScrollTime = Date.now();
                        }
                    }

                    // If this item is at or below the scroll target, the cumulative height
                    // used to position the target has changed. Schedule a corrective re-scroll
                    // once measurements settle (debounced).
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

    function onUserScroll() {}

    // ── Scroll handler ────────────────────────────────────────────────────
    // Fired on every scroll event. Updates fromBottom, runs incremental
    // window update, notifies the chat state (for message loading), and
    // cancels any pending corrective scroll if this was a genuine user scroll.
    function onScroll() {
        if (!viewport || interrupt) return;
        fromBottom = -viewport.scrollTop;
        updateWindowIncremental();
        onUserScroll();

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
        _doScrollToIndex(flatIndex, behavior);
    }

    export function scrollToBottom(behavior: "auto" | "instant" | "smooth" = "instant") {
        clearTimeout(scrollCorrectTimer);
        scrollCorrectTimer = undefined;
        pendingScrollFlatIdx = undefined;
        scrollCorrectCount = 0;
        lastProgrammaticScrollTime = Date.now();
        viewport?.scrollTo({ top: 0, behavior });
    }

    export function scrollToMessageIndex(messageIndex: number) {
        const flatIdx = messageIndexToFlat.get(messageIndex);
        if (flatIdx !== undefined) {
            scrollToIndex(flatIdx, "instant");
        }
    }

    onMount(() => {
        const el = viewport;
        gapPx = parseFloat(getComputedStyle(el).rowGap) || 0;
        el.addEventListener("scroll", onScroll);

        const ro = new ResizeObserver(() => {
            viewportHeight = el.clientHeight;
            updateWindowFull();
        });
        ro.observe(el);
        viewportHeight = el.clientHeight;

        messageObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const idxAttrs = entry.target.attributes.getNamedItem("data-index");
                    const idAttr = entry.target.attributes.getNamedItem("data-id");
                    const idx = idxAttrs
                        ? Math.max(...idxAttrs.value.split(" ").map((v) => parseInt(v, 10)))
                        : undefined;
                    const id = idAttr ? BigInt(idAttr.value) : undefined;
                    if (idx !== undefined) {
                        const ratio =
                            0 < viewportHeight && viewportHeight < entry.boundingClientRect.height
                                ? (viewportHeight * 0.5) / entry.boundingClientRect.height
                                : 0.5;
                        const isIntersecting = entry.intersectionRatio >= ratio;
                        if (isIntersecting && !messageReadTimers.has(idx)) {
                            const ctx = messageContext;
                            const timer = window.setTimeout(() => {
                                if (messageContextsEqual(ctx, messageContext)) {
                                    client.markMessageRead(ctx, idx, id);
                                    messageObserver?.unobserve(entry.target);
                                }
                                messageReadTimers.delete(idx);
                            }, MESSAGE_READ_THRESHOLD);
                            messageReadTimers.set(idx, timer);
                        }
                        if (!isIntersecting && messageReadTimers.has(idx)) {
                            window.clearTimeout(messageReadTimers.get(idx));
                            messageReadTimers.delete(idx);
                        }
                    }
                });
            },
            { root: el, rootMargin: "0px", threshold: [0.1, 0.2, 0.3, 0.4, 0.5] },
        );

        updateWindowFull();

        return () => {
            el.removeEventListener("scroll", onScroll);
            ro.disconnect();
            messageObserver?.disconnect();
            messageObserver = undefined;
            clearTimeout(scrollCorrectTimer);
            scrollCorrectTimer = undefined;
            pendingScrollFlatIdx = undefined;
            for (const timer of messageReadTimers.values()) {
                window.clearTimeout(timer);
            }
            messageReadTimers.clear();
        };
    });

    let visibleItems = $derived(items.slice(start, end));
</script>

<div class="vcl-viewport" class:interrupt id="timeline_container" bind:this={viewport}>
    {#if bottomSpacerHeight > 0}
        <div class="vcl-spacer" style:height="{bottomSpacerHeight}px"></div>
    {/if}
    {#each visibleItems as item, relIdx (item.key)}
        {@const absIdx = start + relIdx}
        <div class="vcl-row" use:measureRow={absIdx}>
            {@render itemView(item)}
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
        height: 100%;
        padding: var(--sp-md);
        gap: var(--sp-xs);
        align-items: center;
        box-sizing: border-box;

        &.interrupt {
            overflow-y: hidden;
        }
    }

    .vcl-spacer {
        flex-shrink: 0;
        width: 100%;
    }

    .vcl-row {
        width: 100%;
        flex-shrink: 0;
        display: flex;
        justify-content: center;
    }
</style>
