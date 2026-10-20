<!-- The conversation's composer (phase 3c, text): who's typing, and the message being written, sent
     with its mentions and markdown as the old UI's MessageEntry sent it. The draft is kept per chat
     (the client's draft messages), and the others are told while the reader types. Where the
     reader can't send, the old footer's reason shows instead. Mount it once per chat (keyed). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        blockedUsersStore,
        byContext as typersByContext,
        currentUserIdStore,
        localUpdates,
        selectedChatDraftMessageStore,
        selectedCommunitySummaryStore,
        type ChatSummary,
        type OpenChat,
    } from "@client";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import ComposerBar from "@openchat/ui/src/lib/components/ComposerBar.svelte";
    import { detectMarkdown } from "@src/utils/detectMarkdown";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { expandMentions, sendBlocked, TypingNotifier } from "./composer";

    let { chat }: { chat: ChatSummary } = $props();

    const client = getContext<OpenChat>("client");
    const context = $derived({ chatId: chat.id });
    const me = $derived($currentUserIdStore);

    const blocked = $derived(
        sendBlocked({
            frozen: client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore),
            blocked: chat.kind === "direct_chat" && $blockedUsersStore.has(chat.them.userId),
            previewing: chat.kind !== "direct_chat" && client.isPreviewing(chat.id),
            lapsed: client.isLapsed(chat.id),
            anonymous: $anonUserStore,
            canSend: client.canSendMessage(chat.id, "message"),
        }),
    );

    // the others in this chat who are typing
    const typingNames = $derived(
        [...($typersByContext.get(context) ?? [])]
            .filter((userId) => userId !== me)
            .map((userId) => client.displayName($allUsersStore.get(userId))),
    );

    // the chat's draft when the composer mounts (it's keyed by chat)
    const draft = untrack(() => $selectedChatDraftMessageStore?.textContent ?? "");

    const typing = new TypingNotifier(
        () => client.startTyping(chat.id, me),
        () => client.stopTyping(chat.id, me),
    );
    $effect(() => () => typing.stopped());

    function onInput(text: string) {
        localUpdates.draftMessages.setTextContent(context, text === "" ? undefined : text);
        typing.input(text);
    }

    function onSend(text: string) {
        const { text: expanded, mentioned } = expandMentions(text, (username) =>
            client.lookupUserForMention(username, false),
        );
        client.sendMessageWithAttachment(
            context,
            expanded,
            detectMarkdown(text),
            undefined,
            mentioned,
        );
        typing.stopped();
    }
</script>

{#if blocked !== undefined}
    <div class="blocked">
        <Banner tone={blocked.tone} text={$_(blocked.key)} />
    </div>
{:else}
    <!-- TODO(phase 6): attachments, GIFs, voice, replies and edits -->
    <ComposerBar text={draft} {typingNames} {onInput} {onSend} />
{/if}

<style>
    .blocked {
        padding: var(--space-12) var(--space-14);
    }
</style>
