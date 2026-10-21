<!-- The conversation's composer (phase 3c, text): who's typing, and the message being written, sent
     with its mentions and markdown as the old UI's MessageEntry sent it. The draft is kept per chat
     (the client's draft messages), and the others are told while the reader types. Where the
     reader can't send, the old footer's reason shows instead; while sending is throttled, a
     countdown shows over it. Mount it once per chat (keyed). -->
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
        suspendedUserStore,
        throttleDeadline,
        type ChatSummary,
        type OpenChat,
    } from "@client";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import ComposerBar from "@openchat/ui/src/lib/components/ComposerBar.svelte";
    import { enterSend } from "@src/stores/settings";
    import { detectMarkdown } from "@src/utils/detectMarkdown";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        entryBlock,
        expandMentions,
        TypingNotifier,
        type EntryBlock,
    } from "@src/logic/composer/composer";

    let { chat }: { chat: ChatSummary } = $props();

    const client = getContext<OpenChat>("client");
    const context = $derived({ chatId: chat.id });
    const me = $derived($currentUserIdStore);

    const blocked = $derived(
        banner(
            entryBlock({
                suspended: $suspendedUserStore,
                frozen: client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore),
                blocked: chat.kind === "direct_chat" && $blockedUsersStore.has(chat.them.userId),
                previewing: chat.kind !== "direct_chat" && client.isPreviewing(chat.id),
                lapsed: client.isLapsed(chat.id),
                direct: chat.kind === "direct_chat",
                externalContent: chat.kind === "channel" && chat.externalUrl !== undefined,
                anonymous: $anonUserStore,
                canSend: client.canSendMessage(chat.id, "message", "text"),
                thread: false,
            }),
        ),
    );

    // what stands in for the composer, as a banner in the old footer's words
    function banner(
        block: EntryBlock | undefined,
    ): { key: string; tone: "info" | "warning" } | undefined {
        switch (block?.kind) {
            case undefined:
                return undefined;
            case "suspended":
                return { key: "accountSuspended", tone: "warning" };
            case "frozen":
                return { key: "chatFrozen", tone: "warning" };
            case "blocked":
                return { key: "userIsBlocked", tone: "info" };
            // TODO(phase 9): a preview's Join (and its access gates), as the old PreviewFooter
            case "preview":
                return { key: block.lapsed ? "access.lapsed.label" : "readOnlyChat", tone: "info" };
            case "external":
                return { key: "externalContent.disclaimer", tone: "warning" };
            case "read_only":
                return { key: block.key, tone: "info" };
        }
    }

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
    // leaving, "stopped typing" would go to the chat selected next, so the others' "typing" is left
    // to run out by itself
    $effect(() => () => typing.cancel());

    function onInput(text: string) {
        // an empty or blank draft is no draft (as the old composer)
        localUpdates.draftMessages.setTextContent(context, text.trim() === "" ? undefined : text);
        typing.input(text);
    }

    // too many messages a minute: a countdown until sending resumes (the old ThrottleCountdown)
    let now = $state(Date.now());
    $effect(() => {
        if ($throttleDeadline <= 0) return;
        const timer = setInterval(() => {
            now = Date.now();
            if ($throttleDeadline <= now) throttleDeadline.set(0);
        }, 500);
        return () => clearInterval(timer);
    });
    const throttled = $derived(
        $throttleDeadline > now
            ? $_("throttleMessage", {
                  values: { time: Math.ceil(($throttleDeadline - now) / 1000) },
              })
            : "",
    );

    // done once the message shows in the chat; refused (throttled, the rules or the PIN turned
    // down, a send already on its way), the composer keeps the draft and says it couldn't send
    async function onSend(text: string): Promise<void> {
        const { text: expanded, mentioned } = expandMentions(text, (username) =>
            client.lookupUserForMention(username, false),
        );
        typing.stopped();
        const outcome = await client.sendMessage(
            context,
            expanded,
            detectMarkdown(text),
            undefined,
            mentioned,
        );
        if (outcome.kind !== "posted") throw new Error(outcome.kind);
    }
</script>

{#if blocked !== undefined}
    <div class="blocked">
        <Banner tone={blocked.tone} text={$_(blocked.key)} />
    </div>
{:else}
    <!-- TODO(phase 6): attachments, GIFs, voice, replies and edits -->
    <ComposerBar
        text={draft}
        {typingNames}
        bannerText={throttled}
        bannerTone="warning"
        enterSends={$enterSend}
        {onInput}
        {onSend} />
{/if}

<style>
    .blocked {
        padding: var(--space-12) var(--space-14);
    }
</style>
