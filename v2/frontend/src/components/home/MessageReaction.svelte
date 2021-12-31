<script lang="ts">
    import { _ } from "svelte-i18n";
    import { fade } from "svelte/transition";
    import type { UserLookup } from "../../domain/user/user";
    import { getContext } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";
    import { rtlStore } from "../../stores/rtl";
    import type { NativeEmoji } from "emoji-picker-element/shared";

    export let reaction: string;
    export let userIds: Set<string>;
    export let me: boolean;
    export let myUserId: string | undefined;

    const TOOLTIP_DELAY = 350;
    let hover = false;
    let userLookup = getContext<UserLookup>("userLookup");
    let tooltipTimer: number | undefined;

    $: selected = myUserId !== undefined ? userIds.has(myUserId) : false;
    $: usernames = hover ? buildReactionUsernames(userIds) : "";
    $: maxWidth = calculateMaxWidth(usernames.length);

    function buildReactionUsernames(userIds: Set<string>): string {
        let usernames =
            userIds.size < 100
                ? Array.from(userIds, (uid) => [uid, userLookup[uid]?.username])
                      .filter(([uid, username]) => username !== undefined && uid !== myUserId)
                      .map(([_, username]) => username)
                      .join(", ")
                : $_("reactions.greaterThan99People");

        return (
            usernames +
            (selected
                ? usernames.length === 0
                    ? $_("reactions.youClickToRemove")
                    : $_("reactions.andYou")
                : "")
        );
    }

    async function buildReactionCode(reaction: string): Promise<string | undefined> {
        const emoji = (await emojiDatabase.getEmojiByUnicodeOrName(reaction)) as
            | NativeEmoji
            | undefined;
        let code =
            emoji?.shortcodes !== undefined
                ? `:${emoji.shortcodes[emoji.shortcodes.length - 1]}:`
                : `"${emoji?.annotation}"`;
        return code ?? ":unknown:";
    }

    function calculateMaxWidth(numChars: number): number {
        return Math.min(300, Math.max(136, Math.sqrt(numChars) * 12.5));
    }

    function startHover() {
        tooltipTimer = window.setTimeout(() => (hover = true), TOOLTIP_DELAY);
    }

    function endHover() {
        window.clearTimeout(tooltipTimer);
        hover = false;
    }
</script>

<div
    on:click
    on:mouseenter={startHover}
    on:mouseleave={endHover}
    on:blur={endHover}
    on:contextmenu|preventDefault={startHover}
    class:selected
    class="message-reaction">
    {reaction}
    <span class="reaction-count">
        {userIds.size > 99 ? "99+" : userIds.size}
    </span>
    {#if hover}
        <div
            transition:fade={{ duration: 100 }}
            class="reaction-tooltip"
            class:right={me != $rtlStore}
            style={`max-width: ${maxWidth}px`}>
            <div class="reaction-tooltip-emoji">{reaction}</div>
            <div>
                <span class="reaction_usernames">{usernames}</span>
                {$_("reactions.reactedWith")}
                <span class="reaction_code">
                    {#await buildReactionCode(reaction) then value}
                        {value}
                    {/await}
                </span>
            </div>
        </div>
    {/if}
</div>

<style type="text/scss">
    .message-reaction {
        @include pop();
        border-radius: $sp4;
        background-color: var(--reaction-bg);
        color: var(--reaction-txt);
        cursor: pointer;
        height: 30px;
        padding: $sp2;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        margin-left: 1px;
        margin-right: 1px;
        margin-bottom: $sp2;
        font-size: 120%;
        position: relative;

        &.selected {
            border: 2px solid var(--reaction-me);
            .reaction-tooltip {
                bottom: 30px;
            }
        }

        .reaction-count {
            @include font(book, normal, fs-60);
            margin-left: $sp2;
        }

        .reaction-tooltip {
            background-color: var(--menu-bg);
            border: 1px solid var(--menu-bd);
            box-shadow: var(--menu-sh);

            display: flex;
            flex-direction: column;
            align-items: center;
            position: absolute;
            @include z-index("reaction-tooltip");
            left: -4px;
            bottom: 34px;
            font-size: 9px;
            width: max-content;
            max-width: 300px;
            padding: $sp2 $sp3 $sp3 $sp3;
            border-radius: $sp3;
            pointer-events: none;
            word-wrap: break-word;

            &.right {
                left: auto;
                right: -4px;

                &:after {
                    right: 18px;
                    left: auto;
                }
            }

            .reaction-tooltip-emoji {
                @include font-size(fs-180);
                margin-bottom: $sp1;
            }

            &:after {
                display: block;
                position: absolute;
                background-color: inherit;
                width: 8px;
                height: 8px;
                bottom: -5px;
                left: 18px;
                transform: rotate(45deg);
                border-right: 1px solid inherit;
                border-bottom: 1px solid inherit;
                content: "";
            }
        }

        .reaction_usernames {
            font-weight: bold;
        }

        .reaction_code {
            word-break: break-all;
        }
    }
</style>
