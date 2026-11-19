<!-- The minimised call (native design notes §3.5, N14): over every screen, draggable to six spots
     clear of the headers and the tab bar. A video call is a tile with the lead's video (or picture)
     and the time; a voice call, or any call on iOS where the native screen has the media, a pill
     with the chat, the time, Mute and Leave. Tapping it opens the call again. A broadcast host's
     waiting requests to speak are a count badge on it, popping as one arrives; the cards are on
     the call screen. -->
<script lang="ts">
    import Badge from "@openchat/ui/src/lib/components/Badge.svelte";
    import SnapFloat from "@openchat/ui/src/lib/components/SnapFloat.svelte";
    import { stream as playStream } from "@openchat/ui/src/lib/behaviours/stream";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";

    type Spot = "tl" | "tr" | "ml" | "mr" | "bl" | "br";

    let {
        title,
        time,
        tile,
        lead,
        muted,
        requests,
        position,
        safeTop,
        safeBottom,
        onSnap,
        onOpen,
        onToggleMute,
        onLeave,
    }: {
        title: string;
        time: string;
        /** The video tile; otherwise the pill. */
        tile: boolean;
        /** Who the tile or pill shows: the first of the others, else the user. */
        lead: {
            initial: string;
            grad: string;
            avatarUrl?: string;
            stream: MediaStream | null;
            /** The user's own camera. */
            mirror: boolean;
        };
        muted: boolean;
        /** A broadcast host's requests to speak, waiting (`miniCallRequests`). */
        requests: number | undefined;
        position: Spot;
        safeTop: number;
        safeBottom: number;
        onSnap: (spot: Spot) => void;
        onOpen: () => void;
        onToggleMute: () => void;
        onLeave: () => void;
    } = $props();

    // the lead's picture that failed to load: the initial shows instead
    let failed = $state<string>();

    // a new request to speak pops the badge
    let pops = $state(0);
    let seen = 0;
    $effect(() => {
        const count = requests ?? 0;
        if (count > seen) untrack(() => pops++);
        seen = count;
    });

    const label = $derived(
        $_("native.call.returnTo", { values: { name: title } }) +
            (requests
                ? `. ${$_("native.call.speakRequests", { values: { count: requests } })}`
                : ""),
    );
</script>

{#snippet face(size: number)}
    <span class="avatar" style:width="{size}px" style:height="{size}px" style:background={lead.grad}>
        {#if lead.avatarUrl && lead.avatarUrl !== failed}
            <img
                class="face-image"
                src={lead.avatarUrl}
                alt=""
                onerror={() => (failed = lead.avatarUrl)}
            />
        {:else}
            {lead.initial}
        {/if}
    </span>
{/snippet}

<div class="layer" data-mode="dark">
    <SnapFloat
        sides
        width={tile ? 112 : 232}
        inset={12}
        {safeTop}
        {safeBottom}
        {position}
        {label}
        onSnap={(spot) => onSnap(spot as Spot)}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="mini"
            class:tile
            role="button"
            tabindex="0"
            aria-label={label}
            onclick={onOpen}
            onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
        >
            {#if tile}
                {#if lead.stream}
                    <video
                        class="feed"
                        class:mirror={lead.mirror}
                        use:playStream={lead.stream}
                        autoplay
                        playsinline
                        muted
                    ></video>
                {:else}
                    <span class="centre">{@render face(48)}</span>
                {/if}
                <span class="time"><span class="dot"></span>{time}</span>
            {:else}
                {@render face(36)}
                <span class="text">
                    <span class="title">{title}</span>
                    <span class="pill-time"><span class="dot"></span>{time}</span>
                </span>
                <button
                    type="button"
                    class="small"
                    class:on={muted}
                    aria-label={$_(muted ? "native.call.unmute" : "native.call.mute")}
                    onclick={(e) => {
                        e.stopPropagation();
                        onToggleMute();
                    }}
                >
                    <span
                        class="glyph"
                        style:mask="var(--icon-{muted ? 'mic-off' : 'mic'}) center/contain no-repeat"
                    ></span>
                </button>
                <button
                    type="button"
                    class="small danger"
                    aria-label={$_("native.call.leave")}
                    onclick={(e) => {
                        e.stopPropagation();
                        onLeave();
                    }}
                >
                    <span class="glyph" style:mask="var(--icon-phone-off) center/contain no-repeat"
                    ></span>
                </button>
            {/if}
        </div>
        {#if requests}
            {#key pops}
                <span class="requests" aria-hidden="true"><Badge label={String(requests)} /></span>
            {/key}
        {/if}
    </SnapFloat>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // over the screens and the tab bar, under the sheets and their veil
    .layer {
        position: fixed;
        inset: 0;
        z-index: calc(var(--z-modal) - 3);
        pointer-events: none;
    }

    .mini {
        pointer-events: auto;
        position: relative;
        box-sizing: border-box;
        height: 52px;
        border-radius: 26px;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 6px 0 8px;
        background: #15151b;
        color: #fff;
        box-shadow:
            0 12px 32px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.12);

        &.tile {
            height: 150px;
            border-radius: 10px;
            padding: 0;
            background: #1d1a22;
        }
    }

    .feed {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .mirror {
        transform: scaleX(-1);
    }

    .centre {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
    }

    .avatar {
        flex: none;
        display: grid;
        place-items: center;
        border-radius: 50%;
        overflow: hidden;
        font: 700 15px/1 var(--font-sans);
        color: #0e0e12;
    }

    .face-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .time {
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        font: 600 11.5px/1 var(--font-mono);
    }

    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--status-online);
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .title {
        font: 700 13px/1.1 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .pill-time {
        display: flex;
        align-items: center;
        gap: 5px;
        font: 600 11.5px/1 var(--font-mono);
        color: var(--status-online);

        .dot {
            width: 6px;
            height: 6px;
        }
    }

    .small {
        flex: none;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.14);
        cursor: pointer;

        &.on {
            background: #fff;

            .glyph {
                background: #0b0b10;
            }
        }

        &.danger {
            background: var(--status-danger);
        }
    }

    .glyph {
        width: 16px;
        height: 16px;
        background: #fff;
    }

    .requests {
        position: absolute;
        inset-block-start: -6px;
        inset-inline-end: -6px;
        pointer-events: none;
        animation: pop 0.4s ease-out;

        @include reduced-motion {
            animation: none;
        }
    }

    @keyframes pop {
        0% {
            transform: scale(0.6);
        }
        60% {
            transform: scale(1.15);
        }
        100% {
            transform: scale(1);
        }
    }
</style>
