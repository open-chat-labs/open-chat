<script lang="ts">
    import { findUser } from "@src/utils/user";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { Avatar, Container } from "component-lib";
    import type { CreatedUser, Message, MultiUserChatIdentifier, OpenChat } from "@client";
    import {
        allUsersStore,
        chatListScopeStore,
        fullWidth,
        routeForMessage,
        selectedChatIdStore,
        selectedChatWebhooksStore,
    } from "@client";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import ChatMessageContent from "@src/mobile/features/chats/core/content/ChatMessageContent.svelte";
    import IntersectionObserver from "@src/mobile/features/chats/core/IntersectionObserver.svelte";
    import RepliesTo from "@src/mobile/features/chats/core/RepliesTo.svelte";
    import MessageBubble from "@src/mobile/features/chats/core/MessageBubble.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: MultiUserChatIdentifier;
        user: CreatedUser;
        senderId: string;
        msg: Message;
        timestamp: bigint;
    }

    let { chatId, user, senderId, msg, timestamp }: Props = $props();

    let sender = $derived(findUser(msg.sender, $allUsersStore, $selectedChatWebhooksStore));
    let fill = $derived(client.fillMessage(msg));
    let me = $derived(user.userId === senderId);
    let modal = $derived(!$fullWidth);

    function openUserProfile(e?: Event) {
        if (!sender) return;

        e?.preventDefault();
        e?.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId: sender.userId,
                    chatButton: !me,
                    inGlobalContext: false,
                },
                bubbles: true,
            }),
        );
    }

    function goToMessageIndex() {
        if ($selectedChatIdStore !== undefined) {
            if (modal) {
                client.popRightPanelHistory();
            }
            navigate(
                routeForMessage(
                    $chatListScopeStore.kind,
                    { chatId: $selectedChatIdStore },
                    msg.messageIndex,
                ),
            );
        }
    }
</script>

<Container gap={"sm"} onClick={goToMessageIndex}>
    <div class="avatar">
        <Avatar onClick={openUserProfile} url={client.userAvatarUrl(sender)} size={"md"} />
    </div>
    <IntersectionObserver>
        {#snippet children(intersecting)}
            <MessageBubble
                {chatId}
                {sender}
                {msg}
                {fill}
                first
                time={Number(timestamp)}
                pinned
                expiresAt={undefined}
                bot={sender?.kind === "bot"}
                onGoToMessageIndex={goToMessageIndex}
                onOpenUserProfile={openUserProfile}
                chatType={chatId.kind}>
                {#snippet repliesTo(reply)}
                    <RepliesTo {intersecting} readonly {chatId} repliesTo={reply} />
                {/snippet}
                {#snippet messageContent(me)}
                    <ChatMessageContent
                        readonly
                        pinned
                        {senderId}
                        {fill}
                        {timestamp}
                        failed={false}
                        messageContext={{ chatId }}
                        edited={msg.edited}
                        messageIndex={msg.messageIndex}
                        messageId={msg.messageId}
                        {me}
                        {intersecting}
                        content={msg.content}
                        blockLevelMarkdown={msg.blockLevelMarkdown}
                        ogPreviews={msg.ogPreviews} />
                {/snippet}
            </MessageBubble>
        {/snippet}
    </IntersectionObserver>
</Container>
