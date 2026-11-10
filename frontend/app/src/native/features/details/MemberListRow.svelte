<!-- A row of the Members screen (native plan 10; picker rows, notes §1 Spacing): the avatar (their
     photo, else their swatch, as the conversation's), the name with a You chip on your own row and
     the @username, and the ⋯ at the end (horizontal dots on iOS, vertical on Android) where there's
     one. Tapping the row opens their profile sheet. -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import type { SenderColor } from "@src/logic/conversation/messageRow";
    import { _ } from "svelte-i18n";

    type Props = {
        name: string;
        username: string;
        photoUrl: string | undefined;
        color: SenderColor;
        isMe: boolean;
        onOpen: () => void;
        /** The ⋯, given the button to anchor its menu to; none without it. */
        onMore: ((anchor: HTMLElement) => void) | undefined;
        /** Resource words for the ⋯'s accessible name, translated. */
        moreLabel?: string;
    };

    let { name, username, photoUrl, color, isMe, onOpen, onMore, moreLabel = "" }: Props =
        $props();
</script>

<div class="row">
    <button type="button" class="person" onclick={onOpen}>
        {#if photoUrl !== undefined}
            <img class="photo" src={photoUrl} alt="" />
        {:else}
            <Avatar size={40} {color} />
        {/if}
        <span class="text">
            <span class="name-line">
                <span class="name">{name}</span>
                {#if isMe}<span class="chip">{$_("native.details.members.you")}</span>{/if}
            </span>
            <span class="handle">@{username}</span>
        </span>
    </button>
    {#if onMore}
        <button
            type="button"
            class="more"
            aria-label={moreLabel}
            aria-haspopup="menu"
            onclick={(e) => onMore(e.currentTarget)}>
            <span class="more-icon"></span>
        </button>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .row {
        display: flex;
        align-items: center;
        border-radius: 14px;

        &:has(.person:active) {
            background: var(--overlay-1);
        }
    }

    .person {
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-10);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .photo {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        object-fit: cover;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .name-line {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .name {
        min-width: 0;
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .chip {
        flex: none;
        padding: 3px 7px;
        border-radius: var(--radius-pill);
        background: var(--accent-soft);
        color: var(--accent-bright);
        font: var(--weight-bold) text-size(10.5px) / 1 var(--font-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .handle {
        font: var(--weight-regular) text-size(13.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .more {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        color: var(--ink-3);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    // horizontal dots on iOS, vertical on Android (notes §2)
    .more-icon {
        @include icon(more, 18px);

        :global([data-os="android"]) & {
            mask: var(--icon-kebab) center/contain no-repeat;
        }
    }
</style>
