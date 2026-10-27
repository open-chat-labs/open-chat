<script lang="ts">
    import {
        OpenChat,
        runningInIframe,
        TWITCH_PLAYER_MIN_WIDTH,
        twitchPlayerParent,
        twitchPlayerUrl,
        twitchPoster,
        twitchWatchUrl,
        type OgPreview,
        type TwitchEmbed,
    } from "@client";
    import Translatable from "@shared_components/Translatable.svelte";
    import { ChatCaption, Label, type ColourVarKeys } from "component-lib";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Play from "svelte-material-icons/Play.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        embed: TwitchEmbed;
        me: boolean;
        // The link's preview, if the sender fetched one, for the poster
        ogPreview: OgPreview | undefined;
    }

    let { embed, me, ogPreview }: Props = $props();

    const client = getContext<OpenChat>("client");

    // Where Twitch won't play (the native apps, a page another site frames) the link opens Twitch
    let parent = $derived(
        twitchPlayerParent({
            hostname: window.location.hostname,
            native: client.isNativeApp(),
            framed: $runningInIframe,
        }),
    );
    let width = $state<number>();
    let playerUrl = $derived(parent !== undefined ? twitchPlayerUrl(embed, parent) : undefined);
    // Twitch won't play in less than 400px, so a narrower bubble (any phone's) links to Twitch
    let fits = $derived(width !== undefined && width >= TWITCH_PLAYER_MIN_WIDTH);
    let shown = $derived(playerUrl !== undefined && fits);
    // Set by a click on the poster, and back to false whenever the player is hidden: the player
    // starts as it loads, so only a click may load it, not a bubble widening again
    let playing = $derived.by(() => {
        void shown;
        return false;
    });
    let { title, image } = $derived(twitchPoster(embed, ogPreview));
    let textColour: ColourVarKeys = $derived(me ? "primaryAccent" : "textSecondary");
    let ctaColour: ColourVarKeys = $derived(me ? "textPrimary" : "secondary");
</script>

<div class="twitch" class:me bind:clientWidth={width}>
    <!-- Asks for the player's width but gives way, so a narrower bubble keeps its own width,
         which is then what's measured -->
    <canvas class="sizer" aria-hidden="true"></canvas>
    {#if shown}
        {#if playing}
            <iframe
                class="player"
                src={playerUrl}
                {title}
                allow="autoplay; fullscreen"
                allowfullscreen>
            </iframe>
        {:else}
            <button
                class="player poster"
                aria-label={$_("twitch.play", { values: { title } })}
                onclick={() => (playing = true)}>
                {#if image !== undefined}
                    <img class="thumbnail" src={image} alt="" loading="lazy" />
                {/if}
                <span class="play">
                    <Play size="2.5rem" color="#fff" />
                </span>
                <span class="caption">
                    <img class="logo" src="/assets/twitch.svg" alt="" />
                    <Label fontWeight="bold" ellipsisTruncate>{title}</Label>
                </span>
            </button>
        {/if}
    {:else if width !== undefined || parent === undefined}
        <a class="watch" href={twitchWatchUrl(embed)} target="_blank" rel="noopener noreferrer">
            <img class="logo" src="/assets/twitch.svg" alt="" />
            <span class="text">
                <Label fontWeight="bold" colour={textColour} ellipsisTruncate>{title}</Label>
                <ChatCaption fontWeight="bold" colour={ctaColour} maxLines={1}>
                    <Translatable resourceKey={i18nKey("twitch.watchOnTwitch")} />
                </ChatCaption>
            </span>
        </a>
    {/if}
</div>

<style lang="scss">
    // Twitch's least is 400x300. A 16:9 player gets there at 534px wide; a narrower one keeps
    // 300px of height and letterboxes.
    .twitch {
        max-width: 534px;
        overflow-anchor: none;
    }

    // A replaced element's percentage max-width lets it shrink to nothing in a bubble that hugs
    // its content, where a div's fixed width would push the bubble past the screen
    .sizer {
        display: block;
        width: 534px;
        max-width: 100%;
        height: 0;
    }

    .player {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 300px;
        border: none;
        background-color: black;
    }

    .poster {
        position: relative;
        padding: 0;
        cursor: pointer;
        color: white;

        .thumbnail {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .play {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            padding: var(--sp-sm);
            border-radius: var(--rad-circle);
            background-color: rgba(0, 0, 0, 0.6);
        }

        .caption {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            gap: var(--sp-sm);
            padding: var(--sp-lg) var(--sp-md) var(--sp-sm);
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
            text-align: start;
        }
    }

    .watch {
        display: flex;
        align-items: center;
        gap: var(--sp-sm);
        padding: var(--sp-sm) var(--sp-md);
        text-decoration: none;

        // takes what's left, however long the title, which it cuts short
        .text {
            display: flex;
            flex-direction: column;
            gap: var(--sp-xxs);
            flex: 1;
            width: 0;
        }
    }

    .me .watch {
        background-color: var(--primary-surface);
    }

    .twitch:not(.me) .watch {
        background-color: var(--surface-1);
    }

    .logo {
        flex: 0 0 auto;
        width: 2rem;
        height: 2rem;
    }
</style>
