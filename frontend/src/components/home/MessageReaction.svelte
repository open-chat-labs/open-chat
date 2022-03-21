<script lang="ts">
    import { _ } from "svelte-i18n";
    import { fade } from "svelte/transition";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import type { UserLookup } from "../../domain/user/user";
    import { getContext, onMount } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";
    import { rtlStore } from "../../stores/rtl";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Hoverable from "../Hoverable.svelte";

    export let reaction: string;
    export let userIds: Set<string>;
    export let me: boolean;
    export let myUserId: string | undefined;

    let userLookup = getContext<UserLookup>("userLookup");
    let usernames = "";
    let reactionCode = "unknown";
    let maxWidth = 150;
    let hovering: boolean;
    let longPressed: boolean;

    $: selected = myUserId !== undefined ? userIds.has(myUserId) : false;
    $: usernames = buildReactionUsernames(userIds);
    $: maxWidth = calculateMaxWidth(usernames.length, reactionCode.length, $mobileWidth);

    onMount(async () => {
        reactionCode = (await buildReactionCode(reaction)) ?? "unknown";
    });

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

    function calculateMaxWidth(
        usernamesLength: number,
        reactionCodeLength: number,
        mobile: boolean
    ): number {
        const MIN_WIDTH = mobile ? 100 : 140;
        const MAX_WIDTH = mobile ? 250 : 300;
        const CHAR_WIDTH = mobile ? 6 : 7;

        let numChars = usernamesLength + 13 + reactionCodeLength;
        let longestWord = reactionCodeLength;
        return Math.max(
            longestWord * CHAR_WIDTH,
            Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.sqrt(numChars) * CHAR_WIDTH * 2))
        );
    }
</script>

<Hoverable bind:hovering bind:longPressed enableLongPress={true}>
    <div on:click class:selected class="message-reaction">
        {reaction}
        <span class="reaction-count">
            {userIds.size > 99 ? "99+" : userIds.size}
        </span>
        {#if hovering || longPressed}
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
                        {reactionCode}
                    </span>
                </div>
            </div>
        {/if}
    </div>
</Hoverable>

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
            @include font-size(fs-50);
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
            word-wrap: break-word;
        }
    }
</style>
