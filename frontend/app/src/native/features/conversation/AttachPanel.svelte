<!-- The attach panel (native plan 06), in the keyboard-area sheet (KeyboardPanel). In the apps, at
     rest: the top row ("N of 10", the handle, Clear), the gallery strip (Camera, All photos, the
     phone's last 100 photos and videos) and the actions (File, Poll, Prize, Send crypto, Swap, Meme
     fighter, 3 × 2), always. Photos and videos tapped go straight into the composer, numbered, up
     to ten: the composer's media are the selection (MediaPicks), so removing one there puts its
     tile back. Grown (dragged up, or All photos), the Recents grid in its place, picked the same,
     with Done pinned at the bottom (back to rest, where the picks show in the composer). On mobile
     web: no strip and no Recents, the browser's picker (Photos & videos) first among the actions,
     in four centred columns. Only what the chat lets the reader send is offered. -->
<script module lang="ts">
    import type { RecentMedia, RecentMediaList } from "@src/utils/native/recentMedia";

    /** A photo or video from the phone, as the strip and Recents show it. */
    export type RecentItem = { id: string; video: boolean; media: RecentMedia; thumb?: string };

    // what the phone listed last, shown again at once the next time the panel opens
    let lastListed: RecentItem[] = [];
</script>

<script lang="ts">
    import { formatClock } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import type { ComposerBuilder } from "@src/logic/composer/composer";
    import { MAX_MEDIA, type MediaPicks } from "@src/logic/composer/mediaPicks.svelte";
    import {
        recentMedia,
        recentMediaThumbnail,
        recentMediaUrl,
    } from "@src/utils/native/recentMedia";
    import { onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { KeyboardPanelState } from "./panelState.svelte";
    import { panelLayers } from "./panelDrag";
    import { panelContentPull, panelDragHandle } from "./panelDragHandle";
    import PanelHandle from "./PanelHandle.svelte";

    type Props = {
        panel: KeyboardPanelState;
        /** The apps' gallery strip and Recents; on mobile web the browser's picker is an action. */
        gallery: boolean;
        /** Photos and videos may be sent. */
        media: boolean;
        /** Files may be sent. */
        file: boolean;
        /** The builders offered (logic/composer's composerBuilders). */
        builders: ComposerBuilder[];
        /** The photos and videos picked: the composer's (the selection). */
        picks: MediaPicks;
        /** A photo or video tapped: picked, or put back (the composer prepares it). */
        onToggle: (item: RecentItem, duration: string | undefined) => void;
        /** The handle's accessible name. */
        handleLabel: string;
        onClose: () => void;
        onCamera: () => void;
        /** The system's photo picker (mobile web's Photos & videos; All photos where none are listed). */
        onPickMedia: () => void;
        onPickFile: () => void;
        onBuild: (builder: ComposerBuilder) => void;
    };

    let {
        panel,
        gallery,
        media,
        file,
        builders,
        picks,
        onToggle,
        handleLabel,
        onClose,
        onCamera,
        onPickMedia,
        onPickFile,
        onBuild,
    }: Props = $props();

    // the phone's last 100 (06): listed as the panel opens, the last list meanwhile
    const RECENT = 100;
    const strip = $derived(gallery && media);
    let items = $state.raw<RecentItem[]>(lastListed);
    let listed = $state(lastListed.length > 0);

    onMount(async () => {
        if (!strip) return;
        const list: RecentMediaList = await recentMedia(RECENT);
        if (list.kind !== "listed") {
            items = [];
            listed = false;
            return;
        }
        items = list.media.map((m) => ({
            id: m.uri,
            video: m.isVideo,
            media: m,
            thumb: recentMediaThumbnail(m),
        }));
        lastListed = items;
        listed = true;
    });

    // a video's length, read from the file where it can be (the plugin doesn't list it)
    let durations = $state<Record<string, string>>({});
    const probes = new Map<string, HTMLVideoElement>();
    $effect(() => {
        for (const item of items) {
            const url = item.video ? recentMediaUrl(item.media) : undefined;
            if (url === undefined || probes.has(item.id)) continue;
            const probe = document.createElement("video");
            probe.preload = "metadata";
            probe.muted = true;
            probe.onloadedmetadata = () => {
                if (Number.isFinite(probe.duration)) {
                    durations = { ...durations, [item.id]: formatClock(probe.duration) };
                }
                probe.removeAttribute("src");
            };
            probe.src = url;
            probes.set(item.id, probe);
        }
    });
    onDestroy(() => probes.forEach((p) => p.removeAttribute("src")));

    const layers = $derived(panelLayers(panel.f));

    function toggle(item: RecentItem) {
        onToggle(item, durations[item.id]);
    }

    function allPhotos() {
        // nothing listed (not allowed, or not there): the system's picker
        if (listed && panel.expandable) panel.expand();
        else onPickMedia();
    }

    function tileLabel(item: RecentItem): string {
        const duration = durations[item.id];
        const name = item.video
            ? duration === undefined
                ? $_("native.composer.attach.video")
                : $_("native.composer.attach.videoLength", { values: { duration } })
            : $_("native.composer.attach.photo");
        const n = picks.numberOf(item.id);
        return n === undefined
            ? name
            : $_("native.composer.attach.selected", { values: { name, n } });
    }

    const ofMax = $derived(
        $_("native.composer.attach.ofMax", { values: { count: picks.count, max: MAX_MEDIA } }),
    );

    // the actions, each in its colour (06: the --action-* tokens, a value per mode): in the apps
    // File and the builders; on mobile web the
    // browser's picker first
    type Action = { id: string; label: string; icon: string; colour: string; onClick: () => void };

    const BUILDERS: Record<ComposerBuilder, { label: string; icon: string; colour: string }> = {
        poll: { label: "native.composer.attach.poll", icon: "poll", colour: "var(--action-poll)" },
        prize: { label: "native.composer.attach.prize", icon: "gift", colour: "var(--accent)" },
        crypto: {
            label: "native.composer.attach.sendCrypto",
            icon: "send",
            colour: "var(--action-crypto)",
        },
        swap: { label: "native.composer.attach.swap", icon: "swap", colour: "var(--action-swap)" },
        memeFighter: {
            label: "native.composer.attach.memeFighter",
            icon: "image",
            colour: "var(--action-meme)",
        },
    };

    const actions = $derived.by((): Action[] => {
        const list: Action[] = [];
        if (media && !gallery) {
            list.push({
                id: "media",
                label: $_("native.composer.attach.photosAndVideos"),
                icon: "image",
                colour: "var(--action-media)",
                onClick: onPickMedia,
            });
        }
        if (file) {
            list.push({
                id: "file",
                label: $_("native.composer.attach.file"),
                icon: "file",
                colour: "var(--action-file)",
                onClick: onPickFile,
            });
        }
        for (const builder of builders) {
            const { label, icon, colour } = BUILDERS[builder];
            list.push({ id: builder, label: $_(label), icon, colour, onClick: () => onBuild(builder) });
        }
        return list;
    });
</script>

{#snippet tile(item: RecentItem, size: "strip" | "grid")}
    {@const n = picks.numberOf(item.id)}
    <button
        type="button"
        class="photo {size}"
        class:on={n !== undefined}
        role="checkbox"
        aria-checked={n !== undefined}
        aria-label={tileLabel(item)}
        style:background-image={item.thumb === undefined ? undefined : `url("${item.thumb}")`}
        onclick={() => toggle(item)}
    >
        {#if item.video}
            <span class="duration">
                <span class="play"></span>{durations[item.id] ?? ""}
            </span>
        {/if}
        {#if n !== undefined}
            <span class="number">{n}</span>
        {/if}
    </button>
{/snippet}

<div class="attach" class:web={!gallery} role="group" aria-label={$_("native.composer.attach.label")}>
    <!-- at rest: the top row, the strip, the actions -->
    <div
        class="layer rest"
        style:opacity={layers.rest}
        style:pointer-events={layers.restLive ? undefined : "none"}
        aria-hidden={!layers.restLive}
    >
        {#if strip}
            <div class="top-row">
                <span class="count" class:shown={picks.count > 0} aria-live="polite">
                    {picks.count > 0 ? ofMax : ""}
                </span>
                <PanelHandle {panel} label={handleLabel} zone="centre" {onClose} />
                <button
                    type="button"
                    class="clear"
                    class:shown={picks.count > 0}
                    tabindex={picks.count > 0 ? 0 : -1}
                    aria-hidden={picks.count === 0}
                    onclick={() => picks.clear()}
                >
                    {$_("native.composer.attach.clear")}
                </button>
            </div>
            <div class="strip" data-tab-swipe="off">
                <button type="button" class="tile" onclick={onCamera}>
                    <span class="tile-icon camera"></span>
                    <span class="tile-label">{$_("native.composer.attach.camera")}</span>
                </button>
                <!-- next to Camera, always in sight (06, 2026-11-09 (d)) -->
                <button type="button" class="tile" onclick={allPhotos}>
                    <span class="tile-icon all"></span>
                    <span class="tile-label">{$_("native.composer.attach.allPhotos")}</span>
                </button>
                {#each items as item (item.id)}
                    {@render tile(item, "strip")}
                {/each}
            </div>
        {/if}
        <div class="actions">
                {#each actions as action (action.id)}
                    <button
                        type="button"
                        class="action"
                        style:--action={action.colour}
                        onclick={action.onClick}
                    >
                        <span class="action-circle">
                            <span
                                class="action-icon"
                                style:mask="var(--icon-{action.icon}) center/contain no-repeat"
                            ></span>
                        </span>
                        <span class="action-label">{action.label}</span>
                    </button>
                {/each}
        </div>
    </div>

    <!-- grown: Recents, picked the same -->
    {#if strip && panel.expandable}
        <div
            class="layer recents"
            style:opacity={layers.expanded}
            style:pointer-events={layers.expandedLive ? undefined : "none"}
            aria-hidden={!layers.expandedLive}
        >
            <PanelHandle {panel} label={$_("native.composer.attach.dragBack")} {onClose} />
            <div class="recents-header" {@attach panelDragHandle(panel)}>
                <button
                    type="button"
                    class="collapse"
                    aria-label={$_("native.composer.attach.collapse")}
                    onclick={() => panel.rest()}
                >
                    <span class="collapse-icon"></span>
                </button>
                <span class="recents-title">{$_("native.composer.attach.recents")}</span>
                <span class="recents-count">
                    {picks.count > 0
                        ? ofMax
                        : $_("native.composer.attach.upTo", { values: { max: MAX_MEDIA } })}
                </span>
            </div>
            <div class="grid-scroll" {@attach panelContentPull(panel)}>
                <div class="grid">
                    {#each items as item (item.id)}
                        {@render tile(item, "grid")}
                    {/each}
                </div>
            </div>
            <div class="pinned" class:shown={picks.count > 0}>
                <Button
                    label={$_("native.composer.attach.done")}
                    icon="check"
                    size="lg"
                    fullWidth
                    onClick={() => panel.rest()}
                />
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .attach {
        position: relative;
        flex: 1;
        min-height: 0;
    }

    .layer {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
    }

    // at rest the layer is the resting height, from the top, whatever the panel's grown to (on
    // mobile web, which doesn't grow, all of it: the actions are centred in it)
    .rest {
        bottom: auto;
        height: var(--panel-rest-content);

        .web & {
            bottom: 0;
        }
    }

    // 06: 76px tiles, 12px corners, 6px apart, scrolled sideways
    .strip {
        flex: none;
        display: flex;
        gap: var(--space-6);
        padding: var(--space-6) var(--space-12) var(--space-16);
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    .tile,
    .photo.strip {
        flex: none;
        width: 76px;
        height: 76px;
        border-radius: var(--radius-md);
    }

    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-6);
        padding: 0;
        border: 0;
        background: var(--overlay-1);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }
    }

    .tile-icon {
        width: 22px;
        height: 22px;
        background: var(--ink);

        &.camera {
            mask: var(--icon-camera) center/contain no-repeat;
        }

        &.all {
            width: 20px;
            height: 20px;
            mask: var(--icon-image) center/contain no-repeat;
        }
    }

    .tile-label {
        font: var(--weight-semibold) text-size(11px) / 1.2 var(--font-sans);
        color: var(--ink-2);
    }

    // a photo or video: picked, ringed in the accent with its number in the corner
    .photo {
        position: relative;
        padding: 0;
        border: 0;
        overflow: hidden;
        background: var(--overlay-1) center / cover no-repeat;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
        }

        &.on::after {
            box-shadow: inset 0 0 0 3px var(--accent);
        }
    }

    .number {
        position: absolute;
        top: 0;
        right: 0;
        box-sizing: border-box;
        min-width: 22px;
        height: 22px;
        padding: 0 var(--space-6);
        display: grid;
        place-items: center;
        border-radius: 0 0 0 8px;
        background: var(--accent);
        font: var(--weight-bold) text-size(11.5px) / 1 var(--font-sans);
        color: var(--on-accent);
    }

    // a video's length (06: 18px, 6px corners, a play glyph and the time)
    .duration {
        position: absolute;
        left: var(--space-6);
        bottom: var(--space-6);
        box-sizing: border-box;
        height: 18px;
        padding: 0 var(--space-6) 0 var(--space-4);
        display: flex;
        align-items: center;
        gap: 2px;
        border-radius: 6px;
        background: var(--on-media-chip);
        font: var(--weight-semibold) text-size(10.5px) / 1 var(--font-mono);
        color: var(--on-media-ink);
    }

    .play {
        width: 10px;
        height: 10px;
        background: currentColor;
        mask: var(--icon-play-filled) center/contain no-repeat;
    }

    // 06: 3 × 2, 52px circles in the action's colour at 16%
    .actions {
        flex: none;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        row-gap: var(--space-14);
        padding: 0 var(--space-12) var(--safe-bottom);

        // mobile web: four centred columns, 56px circles, in the middle of the panel
        .web & {
            flex: 1;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            align-content: center;
            row-gap: var(--space-22);
            padding: var(--space-8) var(--space-12) calc(var(--space-8) + var(--safe-bottom));
        }
    }

    .action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-8);
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active .action-circle {
            filter: brightness(1.2);
        }
    }

    .action-circle {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border-radius: var(--radius-circle);
        background: color-mix(in oklch, var(--action) 16%, transparent);

        .web & {
            width: 56px;
            height: 56px;
        }
    }

    .action-icon {
        width: 22px;
        height: 22px;
        background: var(--action);
    }

    .action-label {
        max-width: 100%;
        font: var(--weight-semibold) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-2);
        text-align: center;
        overflow-wrap: anywhere;
        @include line-clamp(2);
    }

    // 06: the top row, 44px: "N of 10", the handle's zone, Clear (a 44px tap area)
    .top-row {
        flex: none;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        height: 44px;
        padding: 0 var(--space-14);
    }

    .count {
        justify-self: start;
        font: var(--weight-medium) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-3);
        opacity: 0;
        transition: opacity 0.2s ease;

        &.shown {
            opacity: 1;
        }
    }

    .clear {
        justify-self: end;
        height: 44px;
        margin-inline-end: calc(var(--space-14) * -1);
        padding: 0 var(--space-14);
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        -webkit-tap-highlight-color: transparent;

        &.shown {
            opacity: 1;
            pointer-events: auto;
        }
    }

    @include reduced-motion {
        .count,
        .clear {
            transition: none;
        }
    }

    // ---- Recents

    .recents-header {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: 0 var(--space-12) var(--space-8) var(--space-6);
        touch-action: none;
    }

    .collapse {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }
    }

    .collapse-icon {
        @include icon(chevron-down, 22px, var(--ink), $flex: null);
    }

    .recents-title {
        flex: 1;
        font: var(--weight-bold) text-size(17px) / 1.2 var(--font-sans);
        color: var(--ink);
    }

    .recents-count {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    // a pull down at its top drags the panel (panelContentPull): no overscroll of its own
    .grid-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: none;
    }

    // 06: three columns, 4px apart, 6px at the sides; the last row clears Done
    .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-4);
        padding: 0 var(--space-6) calc(var(--safe-bottom) + 88px);
    }

    .photo.grid {
        aspect-ratio: 1;
        border-radius: 10px;

        .duration {
            height: auto;
            padding: 0;
            background: none;
            font-size: text-size(11px);
            text-shadow: 0 1px 2px var(--on-media-chip);

            .play {
                display: none;
            }
        }
    }

    // Done over the grid's end, coming up as something's picked
    .pinned {
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        padding: var(--space-12) var(--space-16) calc(var(--space-12) + var(--safe-bottom));
        background: linear-gradient(to top, var(--surface-1) 70%, transparent);
        opacity: 0;
        transform: translateY(16px);
        pointer-events: none;
        transition:
            opacity 0.2s ease,
            transform 0.24s var(--ease-out);

        &.shown {
            opacity: 1;
            transform: none;
            pointer-events: auto;
        }

        @include reduced-motion {
            transition: opacity 0.2s ease;
            transform: none;
        }
    }
</style>
