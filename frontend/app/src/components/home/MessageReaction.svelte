<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import type { OpenChat, UserLookup } from "openchat-client";
    import { userStore } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";
    import Tooltip from "../tooltip/Tooltip.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        reaction: string;
        userIds: Set<string>;
        myUserId: string | undefined;
        onClick?: () => void;
    }

    let { reaction, userIds, myUserId, onClick }: Props = $props();

    let reactionCode = $state("unknown");
    let longPressed: boolean = $state(false);

    onMount(async () => {
        reactionCode = (await buildReactionCode(reaction)) ?? "unknown";
    });

    function buildReactionUsernames(
        userStore: UserLookup,
        userIds: Set<string>,
        myUserId: string | undefined,
    ): string {
        if (userIds.size === 1 && myUserId !== undefined && userIds.has(myUserId)) {
            return $_("reactions.youClickToRemove");
        }

        return client.buildUsernameList($_, userIds, myUserId, userStore);
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

    function click() {
        if (!longPressed) {
            onClick?.();
        }
    }
    let selected = $derived(myUserId !== undefined ? userIds.has(myUserId) : false);
    let usernames = $derived(buildReactionUsernames($userStore, userIds, myUserId));
</script>

<Tooltip
    textLength={usernames.length + reactionCode.length}
    longestWord={reactionCode.length}
    bind:longPressed
    position={"top"}
    align={"start"}>
    <div onclick={click} class:selected class="message-reaction">
        {reaction}
        <span class="reaction-count">
            {userIds.size > 999 ? "999+" : userIds.size}
        </span>
    </div>
    {#snippet popupTemplate()}
        <div class="reaction-tooltip-emoji">{reaction}</div>
        <div>
            <span class="reaction_usernames">{usernames}</span>
            <Translatable resourceKey={i18nKey("reactions.reactedWith")} />
            <span class="reaction_code">
                {reactionCode}
            </span>
        </div>
    {/snippet}
</Tooltip>

<style lang="scss">
    .message-reaction {
        @include pop();
        border-radius: var(--rd);
        background-color: var(--reaction-bg);
        color: var(--reaction-txt);
        cursor: pointer;
        padding: 3px $sp2;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: $sp2;
        font-size: 120%;

        &.selected {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
        }

        .reaction-count {
            @include font(book, normal, fs-60);
            margin-left: $sp2;
        }
    }

    .reaction-tooltip-emoji {
        @include font-size(fs-180);
        margin-bottom: $sp1;
    }

    .reaction_usernames {
        font-weight: bold;
    }

    .reaction_code {
        word-wrap: break-word;
    }
</style>
