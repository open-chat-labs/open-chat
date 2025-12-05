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

    interface Props {
        alignTooltip?: Alignment;
        reaction: Reaction;
        intersecting: boolean;
        onClick?: (r: Reaction) => void;
    }

    onMount(async () => {
        reactionCode = (await buildReactionCode(reaction.reaction)) ?? "unknown";
    });

    let reactionCode = $state("unknown");
    let { reaction, intersecting, onClick, alignTooltip = "middle" }: Props = $props();
    let customEmoji = $state(getCustomEmoji(reaction.reaction));
    let selected = $derived(reaction.userIds.has($currentUserIdStore));
    let usernames = $derived(
        buildReactionUsernames($allUsersStore, reaction.userIds, $currentUserIdStore),
    );

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
        onClick={() => onClick?.(reaction)}
        borderRadius={"lg"}
        width={"hug"}
        padding={["zero", "xs"]}
        background={selected ? ColourVars.disabledButton : ColourVars.background2}
        crossAxisAlignment={"center"}
        gap={"xs"}
        borderWidth={"thin"}
        borderColour={ColourVars.background0}>
        {#if customEmoji !== undefined}
            {#if intersecting}
                <custom-emoji data-id={customEmoji.code}></custom-emoji>
            {:else}
                ...
            {/if}
        {:else}
            {reaction.reaction}
        {/if}
        <ChatFootnote>
            {reaction.userIds.size > 999 ? "999+" : reaction.userIds.size}
        </ChatFootnote>
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
    .reaction-tooltip-emoji {
        @include font-size(fs-180);
        margin-bottom: $sp1;
    }

    .reaction_code {
        word-wrap: break-word;
    }
</style>
