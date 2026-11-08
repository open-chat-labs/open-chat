<!-- The attach panel (native plan 06), in the keyboard-area slot (KeyboardPanel). In the apps, at
     rest: the gallery strip (Camera, the phone's last 100 photos and videos, All photos) over the
     actions (File, Poll, Prize, Send crypto, Swap, Meme fighter, 3 × 2); photos and videos tapped
     are picked, numbered, up to the most, and while any are the actions give way to what's picked,
     Clear and "Attach N". Grown (dragged up, or All photos), the Recents grid in its place, picked
     the same, with "Attach N" pinned at the bottom. On mobile web: no strip and no Recents, the
     browser's picker (Photos & videos) first among the actions, in four centred columns. Only what
     the chat lets the reader send is offered. -->
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
    import { MediaSelection } from "@src/logic/composer/mediaSelection.svelte";
    import {
        recentMedia,
        recentMediaThumbnail,
        recentMediaUrl,
    } from "@src/utils/native/recentMedia";
    import { onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { KeyboardPanelState } from "./panelState.svelte";
    import { panelLayers } from "./panelDrag";
    import { panelContentPull, panelDragHandle } from "./panelDragHandle";

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
        /** How many photos and videos may still be attached (ten, less those attached). */
        room: number;
        onCamera: () => void;
        /** The system's photo picker (mobile web's Photos & videos; All photos where none are listed). */
        onPickMedia: () => void;
        onPickFile: () => void;
        onBuild: (builder: ComposerBuilder) => void;
        /** "Attach N": what's picked goes to the composer. */
        onAttach: (picked: readonly RecentItem[]) => void;
        /** A pick past the most. */
        onFull: () => void;
    };

    let {
        panel,
        gallery,
        media,
        file,
        builders,
        room,
        onCamera,
        onPickMedia,
        onPickFile,
        onBuild,
        onAttach,
        onFull,
    }: Props = $props();

    // what's picked from the strip and Recents: one selection for both
    const selection = new MediaSelection<RecentItem>(untrack(() => room));
    $effect(() => {
        selection.max = room;
    });

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
        if (selection.toggle(item) === "full") onFull();
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
        const n = selection.numberOf(item.id);
        return n === undefined
            ? name
            : $_("native.composer.attach.selected", { values: { name, n } });
    }

    const summary = $derived.by(() => {
        const { photos, videos } = selection.counts;
        const parts: string[] = [];
        if (photos > 0) parts.push($_("native.composer.attach.photos", { values: { count: photos } }));
        if (videos > 0) parts.push($_("native.composer.attach.videos", { values: { count: videos } }));
        return parts.join(" · ");
    });

    const attachLabel = $derived(
        $_("native.composer.attach.attachCount", { values: { count: selection.count } }),
    );

    function attach() {
        onAttach(selection.picked);
    }

    // the actions, each in its colour (06): in the apps File and the builders; on mobile web the
    // browser's picker first
    type Action = { id: string; label: string; icon: string; colour: string; onClick: () => void };

    const BUILDERS: Record<ComposerBuilder, { label: string; icon: string; colour: string }> = {
        poll: { label: "native.composer.attach.poll", icon: "poll", colour: "var(--attach-poll)" },
        prize: { label: "native.composer.attach.prize", icon: "gift", colour: "var(--accent)" },
        crypto: {
            label: "native.composer.attach.sendCrypto",
            icon: "send",
            colour: "var(--attach-crypto)",
        },
        swap: { label: "native.composer.attach.swap", icon: "swap", colour: "var(--attach-swap)" },
        memeFighter: {
            label: "native.composer.attach.memeFighter",
            icon: "image",
            colour: "var(--attach-meme)",
        },
    };

    const actions = $derived.by((): Action[] => {
        const list: Action[] = [];
        if (media && !gallery) {
            list.push({
                id: "media",
                label: $_("native.composer.attach.photosAndVideos"),
                icon: "image",
                colour: "var(--attach-media)",
                onClick: onPickMedia,
            });
        }
        if (file) {
            list.push({
                id: "file",
                label: $_("native.composer.attach.file"),
                icon: "file",
                colour: "var(--attach-file)",
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
    {@const n = selection.numberOf(item.id)}
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
    <!-- at rest: the strip, then the actions or what's picked -->
    <div
        class="layer rest"
        style:opacity={layers.rest}
        style:pointer-events={layers.restLive ? undefined : "none"}
        aria-hidden={!layers.restLive}
    >
        {#if strip}
            <div class="strip" data-tab-swipe="off">
                <button type="button" class="tile" onclick={onCamera}>
                    <span class="tile-icon camera"></span>
                    <span class="tile-label">{$_("native.composer.attach.camera")}</span>
                </button>
                {#each items as item (item.id)}
                    {@render tile(item, "strip")}
                {/each}
                <button type="button" class="tile" onclick={allPhotos}>
                    <span class="tile-icon all"></span>
                    <span class="tile-label">{$_("native.composer.attach.allPhotos")}</span>
                </button>
            </div>
        {/if}
        {#if selection.count > 0}
            <div class="picked">
                <div class="picked-line">
                    <span class="picked-summary">{summary}</span>
                    <button type="button" class="clear" onclick={() => selection.clear()}>
                        {$_("native.composer.attach.clear")}
                    </button>
                </div>
                <Button label={attachLabel} icon="plus" size="lg" fullWidth onClick={attach} />
            </div>
        {:else}
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
        {/if}
    </div>

    <!-- grown: Recents, picked the same -->
    {#if strip && panel.expandable}
        <div
            class="layer recents"
            style:opacity={layers.expanded}
            style:pointer-events={layers.expandedLive ? undefined : "none"}
            aria-hidden={!layers.expandedLive}
        >
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
                    {selection.count > 0
                        ? $_("native.composer.attach.ofMax", {
                              values: { count: selection.count, max: selection.max },
                          })
                        : $_("native.composer.attach.upTo", { values: { max: selection.max } })}
                </span>
            </div>
            <div class="grid-scroll" {@attach panelContentPull(panel)}>
                <div class="grid">
                    {#each items as item (item.id)}
                        {@render tile(item, "grid")}
                    {/each}
                </div>
            </div>
            <div class="pinned" class:shown={selection.count > 0}>
                <Button label={attachLabel} icon="plus" size="lg" fullWidth onClick={attach} />
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

    // what's picked, in the actions' place (06: the line, then "Attach N", 12px apart)
    .picked {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 0 var(--space-12) var(--safe-bottom);
    }

    .picked-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-12);
    }

    .picked-summary {
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        color: var(--ink-2);
    }

    .clear {
        padding: 0;
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        color: var(--accent);
        cursor: pointer;
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
        overscroll-behavior: none;
        scrollbar-width: none;
    }

    // 06: three columns, 4px apart, 6px at the sides; the last row clears "Attach N"
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

    // "Attach N" over the grid's end, coming up as something's picked
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
