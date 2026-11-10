<!-- The top of a chat's details (native plan 10, Design Notes §3.6): the cover, under the status bar,
     with back, favourite and the kebab as solid round buttons (the kebab only with something in
     it); the 88px avatar with its 4px cut-out ring, overlapping the cover; the name and the line
     under it. The cover is their profile's background where they have one, else the accent's
     gradient (as the You tab's); the avatar their photo, else the chat's swatch (the header's). -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import type { SenderColor } from "@src/logic/conversation/messageRow";
    import { _ } from "svelte-i18n";

    type Props = {
        title: string;
        /** The line under the name: an @username, "Private · 48 members". */
        sub: string;
        coverUrl: string | undefined;
        /** Their photo, else the swatch. */
        photoUrl: string | undefined;
        color: SenderColor;
        /** A group's avatar is a rounded square, as in the lists. */
        square: boolean;
        favourite: boolean;
        onBack: (() => void) | undefined;
        /** No favourite button without it. */
        onFavourite: (() => void) | undefined;
        /** No kebab without it; gets the button, to anchor its menu to. */
        onMore: ((anchor: HTMLElement) => void) | undefined;
    };

    let {
        title,
        sub,
        coverUrl,
        photoUrl,
        color,
        square,
        favourite,
        onBack,
        onFavourite,
        onMore,
    }: Props = $props();
</script>

<div
    class="cover"
    class:image={coverUrl !== undefined}
    style:background-image={coverUrl !== undefined ? `url("${coverUrl}")` : undefined}>
    {#if onBack}
        <button
            type="button"
            class="cover-button back"
            aria-label={$_("native.details.back")}
            onclick={onBack}>
            <span class="back-icon"></span>
        </button>
    {/if}
    <span class="end">
        {#if onFavourite}
            <button
                type="button"
                class="cover-button"
                class:on={favourite}
                aria-label={$_(
                    favourite
                        ? "native.conversation.menu.unfavourite"
                        : "native.conversation.menu.favourite",
                )}
                aria-pressed={favourite}
                onclick={onFavourite}>
                <span class="heart-icon"></span>
            </button>
        {/if}
        {#if onMore}
            <button
                type="button"
                class="cover-button"
                aria-label={$_("native.conversation.options")}
                aria-haspopup="menu"
                onclick={(e) => onMore(e.currentTarget)}>
                <span class="more-icon"></span>
            </button>
        {/if}
    </span>
</div>

<div class="identity">
    <span class="avatar" class:square>
        {#if photoUrl !== undefined}
            <img src={photoUrl} alt="" />
        {:else}
            <Avatar size={88} shape={square ? "squircle" : "circle"} {color} />
        {/if}
    </span>
    <span class="name">{title}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // under the status bar, 132px below it, as the You tab's
    .cover {
        position: relative;
        flex: none;
        height: calc(var(--safe-top) + 132px);
        background: linear-gradient(
            140deg,
            var(--accent) 0%,
            color-mix(in oklch, var(--accent) 40%, var(--hero-base)) 100%
        );

        &.image {
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
        }
    }

    .end {
        position: absolute;
        top: calc(var(--safe-top) + 6px);
        inset-inline-end: 8px;
        display: flex;
        gap: 8px;
    }

    .cover-button {
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: var(--surface-0);
        color: var(--ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--surface-2);
        }

        &:focus-visible {
            @include focus-ring;
        }

        &.back {
            position: absolute;
            top: calc(var(--safe-top) + 6px);
            inset-inline-start: 8px;
        }

        &.on {
            color: var(--accent);
        }
    }

    // back: a chevron on iOS, an arrow on Android (the kit's header's)
    .back-icon {
        @include icon(chevron-right, 20px);
        transform: rotate(180deg);

        &:dir(rtl) {
            transform: none;
        }

        :global([data-os="android"]) & {
            mask: var(--icon-back) center/contain no-repeat;
            transform: none;

            &:dir(rtl) {
                transform: scaleX(-1);
            }
        }
    }

    .heart-icon {
        @include icon(heart, 19px);

        .on & {
            mask: var(--icon-heart-filled) center/contain no-repeat;
        }
    }

    // the kebab: horizontal dots on iOS, vertical on Android
    .more-icon {
        @include icon(more, 19px);

        :global([data-os="android"]) & {
            mask: var(--icon-kebab) center/contain no-repeat;
        }
    }

    .identity {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: -44px;
        padding: 0 var(--space-16);
    }

    .avatar {
        width: 88px;
        height: 88px;
        margin-bottom: 6px;
        display: flex;
        border-radius: var(--radius-circle);
        background: var(--surface-0);
        box-shadow: 0 0 0 4px var(--surface-0);

        &.square {
            border-radius: 33%;
        }

        img {
            width: 100%;
            height: 100%;
            border-radius: inherit;
            object-fit: cover;
        }
    }

    .name {
        font: 800 text-size(24px) / 1.15 var(--font-sans);
        letter-spacing: -0.01em;
        overflow-wrap: anywhere;
    }

    .sub {
        font: var(--weight-medium) text-size(13.5px) / 1.3 var(--font-sans);
        color: var(--ink-4);
        overflow-wrap: anywhere;
    }
</style>
