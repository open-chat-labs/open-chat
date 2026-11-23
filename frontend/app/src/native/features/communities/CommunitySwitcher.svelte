<!-- The Communities tab's switcher (native plan 12 "Switcher: strip ↔ sheet", Design Notes §3.8): one surface at
     the bottom of a community's page. Collapsed, it's the strip: the user's communities as 42px avatars (the one
     showing ringed, an unread count on each), then the compass to Explore; a tap switches. Dragged up (or the handle
     tapped) it grows into the sheet: search, "Your communities" as 58px rows (a tap switches and closes it, the grip
     drags a row to a new place), and Explore / Create. Everything follows one factor, f (switcher.ts): the strip
     fades out, the sheet's content in, and the fill, corners, shadow and the dim behind it follow; the surface
     follows the finger and settles by a flick, a quick drag or where it is. A long-press on an avatar or a row opens
     the community's menu (the host's). Android's back, the dim or a pick closes the sheet. Reduced motion: it settles
     at once. -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import { longPress } from "@openchat/ui/src/native/longPress";
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";
    import { matchingCommunities, type SwitcherCommunity } from "./community.adapter";
    import {
        DRAG_SLOP,
        dragFactor,
        dropIndex,
        heightFor,
        isOpen,
        lookAt,
        maxHeight,
        moved,
        releaseTarget,
        releaseVelocity,
        rowShift,
        settleAt,
        settleDuration,
        withSample,
        type DragSample,
    } from "./switcher";

    type Props = {
        communities: SwitcherCommunity[];
        overlays: Overlays;
        /** A community picked (the strip's avatar or the sheet's row). */
        onPick: (community: SwitcherCommunity) => void;
        /** Held on a community, in the strip or the sheet: its menu, lifting `target`. */
        onPress: (community: SwitcherCommunity, target: HTMLElement) => void;
        /** The sheet's rows in a new order (a row dragged by its grip). */
        onReorder: (order: SwitcherCommunity[]) => void;
        onExplore: () => void;
        onCreate: () => void;
    };

    let { communities, overlays, onPick, onPress, onReorder, onExplore, onCreate }: Props =
        $props();

    // the page's height, which the sheet grows into
    let hostHeight = $state(786);
    const max = $derived(maxHeight(hostHeight));

    let f = $state(0);
    const look = $derived(lookAt(f));
    const open = $derived(isOpen(f));

    // ---- settling: to the strip (0) or the sheet (1), eased out, at once with reduced motion

    let frame = 0;
    onDestroy(() => cancelAnimationFrame(frame));

    function reducedMotion(): boolean {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function settle(to: 0 | 1) {
        cancelAnimationFrame(frame);
        if (to === 0) query = "";
        const from = f;
        const duration = reducedMotion() ? 0 : settleDuration(from, to);
        const start = performance.now();
        const step = (now: number) => {
            f = settleAt(from, to, now - start, duration);
            if (f !== to) frame = requestAnimationFrame(step);
        };
        if (duration === 0) f = to;
        else frame = requestAnimationFrame(step);
    }

    /** Closes the sheet (the host's pick, Explore, Create). */
    export function collapse() {
        settle(0);
    }

    useOverlay(
        overlays,
        () => open,
        () => settle(0),
    );

    // ---- the drag, from the handle or the strip: followed on the window, so a quick drag that
    // leaves the handle still counts; a drag starting sideways on the strip is the strip's scroll

    type Drag = {
        pointerId: number;
        x0: number;
        y0: number;
        f0: number;
        t0: number;
        moved: boolean;
        samples: DragSample[];
        handle: boolean;
    };
    let drag: Drag | undefined;
    // the click that ends a drag isn't a tap on what it ended over
    let swallowClick = false;

    function startDrag(e: PointerEvent, handle: boolean) {
        if (e.button !== 0 || !e.isPrimary) return;
        cancelAnimationFrame(frame);
        drag = {
            pointerId: e.pointerId,
            x0: e.clientX,
            y0: e.clientY,
            f0: f,
            t0: e.timeStamp,
            moved: false,
            samples: [{ t: e.timeStamp, y: e.clientY }],
            handle,
        };
        window.addEventListener("pointermove", moveDrag, { passive: false });
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
    }

    function moveDrag(e: PointerEvent) {
        if (drag === undefined || e.pointerId !== drag.pointerId) return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        if (!drag.moved) {
            if (Math.abs(dy) < DRAG_SLOP && Math.abs(dx) < DRAG_SLOP) return;
            // sideways first: the strip's own scroll
            if (!drag.handle && Math.abs(dx) > Math.abs(dy)) {
                stopListening();
                drag = undefined;
                return;
            }
            drag.moved = true;
        }
        e.preventDefault();
        drag.samples = withSample(drag.samples, { t: e.timeStamp, y: e.clientY });
        f = dragFactor(drag.f0, dy, max);
    }

    function endDrag(e: PointerEvent) {
        const ended = drag;
        if (ended === undefined || e.pointerId !== ended.pointerId) return;
        stopListening();
        drag = undefined;
        if (!ended.moved) {
            // a tap on the handle opens or closes it
            if (ended.handle) settle(open ? 0 : 1);
            return;
        }
        swallowClick = true;
        setTimeout(() => (swallowClick = false), 0);
        settle(
            releaseTarget({
                velocity: releaseVelocity(ended.samples),
                elapsed: e.timeStamp - ended.t0,
                distance: e.clientY - ended.y0,
                f,
            }),
        );
    }

    function stopListening() {
        window.removeEventListener("pointermove", moveDrag);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }
    onDestroy(stopListening);

    function onHandleKey(e: KeyboardEvent) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        settle(open ? 0 : 1);
    }

    function pick(community: SwitcherCommunity, close: boolean) {
        if (swallowClick) return;
        onPick(community);
        if (close) settle(0);
    }

    function explore() {
        settle(0);
        onExplore();
    }

    function create() {
        settle(0);
        onCreate();
    }

    // ---- the sheet: search, and a row dragged by its grip to a new place

    let query = $state("");
    const shown = $derived(matchingCommunities(communities, query));

    type RowDrag = { pointerId: number; from: number; y0: number; dy: number };
    let rowDrag = $state<RowDrag>();

    function startRowDrag(e: PointerEvent, index: number) {
        if (e.button !== 0 || !e.isPrimary || query.trim() !== "") return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        rowDrag = { pointerId: e.pointerId, from: index, y0: e.clientY, dy: 0 };
    }

    function moveRowDrag(e: PointerEvent) {
        if (rowDrag === undefined || e.pointerId !== rowDrag.pointerId) return;
        rowDrag = { ...rowDrag, dy: e.clientY - rowDrag.y0 };
    }

    function endRowDrag(e: PointerEvent) {
        const ended = rowDrag;
        if (ended === undefined || e.pointerId !== ended.pointerId) return;
        rowDrag = undefined;
        const to = dropIndex(ended.from, ended.dy, communities.length);
        if (to !== ended.from) onReorder(moved(communities, ended.from, to));
    }

    // the grip from the keyboard: up a place
    function moveUp(index: number) {
        if (index > 0) onReorder(moved(communities, index, index - 1));
    }
</script>

<div class="switcher" bind:clientHeight={hostHeight}>
    <!-- the dim behind the sheet: a tap closes it -->
    <div
        class="dim"
        class:live={look.dim > 0.02}
        style:opacity={look.dim}
        data-tab-swipe="off"
        aria-hidden="true"
        onclick={() => settle(0)}
    ></div>
    <!-- the sheet's shadow, strengthening as it grows -->
    <div
        class="shade"
        style:height="{heightFor(f, max)}px"
        style:--radius="{look.radius}px"
        style:opacity={look.fill}
    ></div>
    <div
        class="surface"
        role={open ? "dialog" : "region"}
        aria-label={$_("native.community.switcher.label")}
        data-tab-swipe={open ? "off" : undefined}
        style:height="{heightFor(f, max)}px"
        style:--radius="{look.radius}px"
    >
        <div class="fill" style:opacity={look.fill}></div>
        <div
            class="handle"
            class:open
            role="button"
            tabindex="0"
            aria-label={$_(
                open ? "native.community.switcher.collapse" : "native.community.switcher.expand",
            )}
            aria-expanded={open}
            onpointerdown={(e) => startDrag(e, true)}
            onkeydown={onHandleKey}
        >
            <span class="bar"></span>
        </div>
        <div class="content">
            <!-- the strip: sideways it scrolls, up it grows the sheet -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="strip"
                style:opacity={look.strip}
                class:off={look.strip < 0.5}
                aria-hidden={look.strip < 0.5}
                data-tab-swipe="off"
                onpointerdown={(e) => startDrag(e, false)}
            >
                <div class="strip-row">
                    {#each communities as community (community.key)}
                        <button
                            type="button"
                            class="strip-item"
                            class:current={community.current}
                            aria-label={community.name}
                            aria-current={community.current}
                            tabindex={look.strip < 0.5 ? -1 : 0}
                            use:longPress={(el) => onPress(community, el)}
                            onclick={() => pick(community, false)}
                        >
                            <Avatar
                                size={42}
                                shape="squircle"
                                color={community.color}
                                url={community.avatarUrl}
                            />
                            {#if community.unread > 0}
                                <span class="badge">{community.unread}</span>
                            {/if}
                        </button>
                    {/each}
                    <button
                        type="button"
                        class="explore"
                        aria-label={$_("native.community.switcher.explore")}
                        tabindex={look.strip < 0.5 ? -1 : 0}
                        onclick={() => !swallowClick && onExplore()}
                    >
                        <span class="compass"></span>
                    </button>
                </div>
            </div>

            <div
                class="sheet"
                style:opacity={look.sheet}
                class:off={look.sheet < 0.5}
                aria-hidden={look.sheet < 0.5}
                inert={look.sheet < 0.5}
            >
                <div class="sheet-scroll" class:scrolls={f > 0.995}>
                    <Field
                        placeholder={$_("native.community.switcher.search")}
                        value={query}
                        onInput={(e) => (query = e.currentTarget.value)}
                        onClear={() => (query = "")}
                        showShortcut={false}
                    />
                    <div class="section">
                        <span class="label">{$_("native.community.switcher.yours")}</span>
                        <div
                            class="rows"
                            role="list"
                            aria-label={$_("native.community.switcher.reorder")}
                        >
                            {#each shown as community, i (community.key)}
                                <div
                                    class="row"
                                    class:current={community.current}
                                    class:dragged={rowDrag?.from === i}
                                    role="listitem"
                                    style:transform={rowDrag === undefined
                                        ? undefined
                                        : `translateY(${rowShift(i, rowDrag.from, rowDrag.dy, shown.length)}px)`}
                                    use:longPress={(el) => onPress(community, el)}
                                >
                                    <button
                                        type="button"
                                        class="row-pick"
                                        onclick={() => pick(community, true)}
                                    >
                                        <Avatar
                                            size={42}
                                            shape="squircle"
                                            color={community.color}
                                            url={community.avatarUrl}
                                        />
                                        <span class="texts">
                                            <span class="name">{community.name}</span>
                                            <span class="sub">{community.sub}</span>
                                        </span>
                                        {#if community.unread > 0}
                                            <span class="count">{community.unread}</span>
                                        {/if}
                                        {#if community.current}
                                            <span class="check"></span>
                                        {/if}
                                    </button>
                                    {#if query.trim() === ""}
                                        <button
                                            type="button"
                                            class="grip"
                                            aria-label={$_("native.community.switcher.moveUp", {
                                                values: { name: community.name },
                                            })}
                                            onpointerdown={(e) => startRowDrag(e, i)}
                                            onpointermove={moveRowDrag}
                                            onpointerup={endRowDrag}
                                            onpointercancel={endRowDrag}
                                            onclick={(e) => e.detail === 0 && moveUp(i)}
                                        >
                                            <span class="dots"></span>
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <Button
                        label={$_("native.community.switcher.exploreButton")}
                        icon="compass"
                        variant="secondary"
                        size="lg"
                        fullWidth
                        onClick={explore}
                    />
                    <Button
                        label={$_("native.community.switcher.create")}
                        icon="plus"
                        variant="secondary"
                        size="lg"
                        fullWidth
                        onClick={create}
                    />
                </div>
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // over the page, from its top to the tab bar; only the surface (and the dim while it shows)
    // takes touches
    .switcher {
        position: absolute;
        inset: 0;
        z-index: 4;
        overflow: hidden;
        pointer-events: none;
    }

    .dim {
        position: absolute;
        inset: 0;
        background: var(--veil-sheet);

        &.live {
            pointer-events: auto;
        }
    }

    .surface {
        position: absolute;
        inset: auto 0 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        pointer-events: auto;
        border-radius: var(--radius) var(--radius) 0 0;
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
    }

    .shade {
        position: absolute;
        inset: auto 0 0;
        border-radius: var(--radius) var(--radius) 0 0;
        box-shadow: var(--shadow-sheet);
    }

    // the sheet's raised colour, coming in as it grows
    .fill {
        position: absolute;
        inset: 0;
        background: var(--surface-1);
        pointer-events: none;
    }

    .handle {
        position: relative;
        flex: none;
        display: flex;
        justify-content: center;
        padding: var(--space-8) 0 var(--space-6);
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;

        &.open {
            padding: var(--space-12) 0 var(--space-14);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .bar {
        width: 48px;
        height: 4px;
        border-radius: 2px;
        background: var(--overlay-3);
    }

    .content {
        position: relative;
        flex: 1;
        min-height: 0;
    }

    .strip {
        position: absolute;
        inset: 0 0 auto;
        touch-action: pan-x;

        &.off {
            pointer-events: none;
        }
    }

    .strip-row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-6) 18px;
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    .strip-item {
        position: relative;
        flex: none;
        width: 42px;
        height: 42px;
        padding: 0;
        border: 0;
        border-radius: 14px;
        background: none;
        cursor: pointer;
        transition: box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;

        &.current {
            box-shadow:
                0 0 0 2px var(--surface-0),
                0 0 0 4px var(--accent);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .badge,
    .count {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        box-sizing: border-box;
        border-radius: 9px;
        background: var(--accent);
        color: var(--on-accent);
        font: var(--weight-bold) 10.5px / 18px var(--font-sans);
        text-align: center;
    }

    .badge {
        position: absolute;
        top: -2px;
        inset-inline-end: -2px;
        box-shadow: 0 0 0 2px var(--surface-0);
    }

    .explore {
        flex: none;
        width: 42px;
        height: 42px;
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: var(--overlay-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .compass {
        @include icon(compass, 18px, var(--ink-3));
    }

    .sheet {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;

        &.off {
            pointer-events: none;
        }
    }

    .sheet-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: hidden;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: var(--space-8) var(--space-16) var(--space-16);

        &.scrolls {
            overflow-y: auto;
        }
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .label {
        padding-inline-start: 2px;
        font: var(--weight-semibold) 11.5px / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
    }

    .row {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 58px;
        margin: 0 -6px;
        padding: var(--space-8);
        box-sizing: border-box;
        border-radius: 14px;
        transition: transform 0.18s var(--ease-out);

        &.current {
            background: var(--overlay-1);
        }

        &.dragged {
            z-index: 1;
            transition: none;
            background: var(--surface-2);
            box-shadow: var(--shadow-push);
        }

        @include reduced-motion {
            transition: none;
        }
    }

    .row-pick {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        text-align: start;
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .name {
        font: var(--weight-bold) text-size(15px) / 1.2 var(--font-sans);
        color: var(--ink);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
        @include glyph-room;
    }

    .count {
        flex: none;
        min-width: 20px;
        height: 20px;
        line-height: 20px;
        border-radius: 10px;
    }

    .check {
        @include icon(check, 18px, var(--accent));
    }

    .grip {
        flex: none;
        width: 32px;
        height: 40px;
        margin-inline-end: -6px;
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: grab;
        touch-action: none;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .dots {
        width: 12px;
        height: 14px;
        background: radial-gradient(circle, var(--ink-4) 1.3px, transparent 1.6px) 0 0 / 6px 5px;
    }

    .actions {
        flex: none;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-8);
        padding: var(--space-16);
        box-shadow: inset 0 1px 0 var(--line-1);
    }
</style>
