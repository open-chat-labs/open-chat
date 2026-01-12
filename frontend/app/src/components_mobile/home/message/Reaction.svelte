<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { emojiDatabase } from "@src/utils/emojis";
    import { ChatFootnote, ColourVars, Container, Tooltip, type Alignment } from "component-lib";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import type { CustomEmoji, Reaction, UserLookup } from "openchat-client";
    import { allUsersStore, currentUserIdStore, customEmojis, OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    type ReactionSize = "normal" | "large";

    interface Props {
        reaction: Reaction;
        intersecting: boolean;
        size?: ReactionSize;
        alignTooltip?: Alignment;
        onClick?: (r: Reaction) => void;
    }

    onMount(async () => {
        reactionCode = (await buildReactionCode(reaction.reaction)) ?? "unknown";
    });

    let reactionCode = $state("unknown");
    let {
        reaction,
        intersecting,
        onClick,
        size = "normal",
        alignTooltip = "middle",
    }: Props = $props();
    let customEmoji = $state(getCustomEmoji(reaction.reaction));
    let selected = $derived(reaction.userIds.has($currentUserIdStore));
    let usernames = $derived(
        buildReactionUsernames($allUsersStore, reaction.userIds, $currentUserIdStore),
    );
    let moreThanOne = $derived(reaction.userIds.size > 1);

    function getCustomEmoji(reaction: string): CustomEmoji | undefined {
        const match = reaction.match(/^@(?:CustomEmoji|CE)\(([\w-]+)\)$/);
        const code = match ? match[1] : undefined;
        return code ? customEmojis.get(code) : undefined;
    }

    async function buildReactionCode(reaction: string): Promise<string | undefined> {
        if (customEmoji !== undefined) {
            return `:${customEmoji.code}:`;
        }
        const emoji = (await emojiDatabase.getEmojiByUnicodeOrName(reaction)) as
            | NativeEmoji
            | undefined;
        if (!emoji) return reaction;
        let code =
            emoji?.shortcodes !== undefined
                ? `:${emoji.shortcodes[emoji.shortcodes.length - 1]}:`
                : `"${emoji?.annotation}"`;
        return code ?? ":unknown:";
    }

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
</script>

<Tooltip position={"top"} align={alignTooltip}>
    <Container
        supplementalClass={`reaction ${size}`}
        onClick={() => onClick?.(reaction)}
        width={"hug"}
        minWidth={"2.25rem"}
        padding={["xxs", moreThanOne ? "sm" : "xs", "xxs", "xs"]}
        background={selected ? ColourVars.disabledButton : ColourVars.background2}
        crossAxisAlignment={"center"}
        mainAxisAlignment={"center"}
        gap={"xxs"}
        borderRadius={"circle"}
        borderWidth={intersecting ? "thick" : undefined}
        borderColour={ColourVars.background0}>
        {#if customEmoji !== undefined}
            {#if intersecting}
                <custom-emoji class="emoji" data-id={customEmoji.code}></custom-emoji>
            {:else}
                ...
            {/if}
        {:else}
            <div class="emoji">{reaction.reaction}</div>
        {/if}
        {#if moreThanOne}
            <ChatFootnote fontWeight="bold">
                {reaction.userIds.size > 999 ? "999+" : reaction.userIds.size}
            </ChatFootnote>
        {/if}
    </Container>
    {#snippet popup()}
        <div class="reaction-tooltip-emoji">
            {#if customEmoji !== undefined}
                <custom-emoji data-id={customEmoji.code} big></custom-emoji>
            {:else}
                {reaction.reaction}
            {/if}
        </div>
        <div>
            <ChatFootnote fontWeight={"bold"}>{usernames}</ChatFootnote>
            <ChatFootnote>
                <Translatable resourceKey={i18nKey("reactions.reactedWith")} />
                <span class="reaction_code">
                    {reactionCode}
                </span>
            </ChatFootnote>
        </div>
    {/snippet}
</Tooltip>

<style lang="scss">
    :global(.reaction.normal) {
        --emoji-font-size: 1rem;
        --reaction-min-width: 1.75rem;
        --reaction-height: 1.25rem;
    }

    :global(.reaction.large) {
        --emoji-font-size: 1.25rem;
        --reaction-min-width: 2rem;
        --reaction-height: 1.5rem;
    }

    .emoji {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--emoji-font-size);
        min-width: var(--reaction-min-width);
        height: var(--reaction-height);
    }

    .reaction-tooltip-emoji {
        @include font-size(fs-180);
        margin-bottom: $sp1;
    }

    .reaction_code {
        word-wrap: break-word;
    }
</style>
