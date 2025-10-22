<script lang="ts">
    import { Avatar, SectionHeader } from "component-lib";
    import type {
        ChatIdentifier,
        ChatSummary,
        EventWrapper,
        Message,
        OpenChat,
        TypersByKey,
    } from "openchat-client";
    import {
        allUsersStore,
        byContext,
        mobileWidth,
        selectedCommunitySummaryStore,
        UserStatus,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../../../stores/time";
    import Typing from "../../Typing.svelte";
    import Markdown from "../../home/Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatSummary: ChatSummary;
        rootEvent: EventWrapper<Message>;
        threadRootMessageIndex: number;
        onCloseThread: (id: ChatIdentifier) => void;
    }

    let { chatSummary, rootEvent, threadRootMessageIndex, onCloseThread }: Props = $props();

    function close() {
        onCloseThread(chatSummary.id);
    }

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const someoneTyping = client.getTypingString(
            $_,
            $allUsersStore,
            { chatId: chatSummary.id, threadRootMessageIndex },
            typing,
        );

        const msgTxt = rootEvent ? client.getContentAsText($_, rootEvent.event.content) : "";
        const subtext =
            someoneTyping ?? ($mobileWidth ? `${$_("thread.title")}: ${msgTxt}` : msgTxt);
        if (chatSummary.kind === "direct_chat") {
            return {
                title: $mobileWidth
                    ? $allUsersStore.get(chatSummary.them.userId)?.username
                    : $_("thread.title"),
                avatarUrl: client.userAvatarUrl($allUsersStore.get(chatSummary.them.userId)),
                userId: chatSummary.them.userId,
                subtext,
                typing: someoneTyping !== undefined,
            };
        }
        return {
            title: $mobileWidth ? chatSummary.name : $_("thread.title"),
            userStatus: UserStatus.None,
            avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunitySummaryStore),
            userId: undefined,
            subtext,
            typing: someoneTyping !== undefined,
        };
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            if (!document.getElementById("portal-element")) {
                close();
            }
        }
    }
    let chat = $derived(normaliseChatSummary($now, chatSummary, $byContext));
</script>

<svelte:window onkeydown={onKeyDown} />

<SectionHeader onBack={close}>
    {#snippet avatar()}
        <Avatar url={chat.avatarUrl} size={"lg"} />
    {/snippet}
    {#snippet title()}
        {chat.title}
    {/snippet}
    {#snippet subtitle()}
        {#if chat.typing}
            {chat.subtext} <Typing />
        {:else}
            <Markdown text={chat.subtext} oneLine suppressLinks />
        {/if}
    {/snippet}
</SectionHeader>
