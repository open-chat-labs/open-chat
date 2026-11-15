<script lang="ts">
    import { findUser } from "@src/utils/user";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { Avatar, Caption, Container } from "component-lib";
    import type { CreatedUser, Message, MultiUserChatIdentifier, OpenChat } from "@client";
    import {
        allUsersStore,
        bridgedFrom,
        bridgedUserKey,
        bridgedUsersStore,
        chatListScopeStore,
        fullWidth,
        linkedAuthor,
        routeForMessage,
        selectedChatIdStore,
        selectedChatWebhooksStore,
        shouldShowAsMe,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext } from "svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { toastStore } from "@src/stores/toast";
    import { i18nKey } from "../../../i18n/i18n";
    import ChatMessageContent from "../ChatMessageContent.svelte";
    import IntersectionObserver from "../IntersectionObserver.svelte";
    import RepliesTo from "../RepliesTo.svelte";
    import MessageBubble from "../message/MessageBubble.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: MultiUserChatIdentifier;
        canUnpin: boolean;
        user: CreatedUser;
        senderId: string;
        msg: Message;
        timestamp: bigint;
    }

    let { chatId, canUnpin, user, senderId, msg, timestamp }: Props = $props();

    let sender = $derived(findUser(msg.sender, $allUsersStore, $selectedChatWebhooksStore));
    // Who the message is shown as from, as in the chat: the OpenChat user who linked the account a
    // bridge bot relayed it from, or else the account itself
    let bridged = $derived(bridgedFrom(msg.senderContext));
    let bridgedUser = $derived(
        bridged !== undefined ? $bridgedUsersStore.get(bridgedUserKey(bridged)!) : undefined,
    );
    let linkedUser = $derived(linkedAuthor(bridgedUser, $allUsersStore));
    let fill = $derived(client.fillMessage(msg));
    let me = $derived(shouldShowAsMe(user.userId === senderId, linkedUser?.userId, user.userId));
    let modal = $derived(!$fullWidth);

    function openUserProfile(e?: Event) {
        if (!sender) return;

        e?.preventDefault();
        e?.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId: linkedUser?.userId ?? sender.userId,
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

    async function unpinMessage() {
        if (!(await client.unpinMessage(chatId, msg.messageIndex))) {
            toastStore.showFailureToast(i18nKey("unpinMessageFailed"));
        }
    }
</script>

<Container gap={"sm"} onClick={goToMessageIndex}>
    <div class="avatar">
        <Avatar
            onClick={openUserProfile}
            url={linkedUser !== undefined
                ? client.userAvatarUrl(linkedUser)
                : bridged !== undefined
                  ? client.bridgedAvatarUrl(bridged, bridgedUser)
                  : client.userAvatarUrl(sender)}
            size={"md"} />
    </div>
    <Container direction={"vertical"} gap={"xs"}>
        <IntersectionObserver>
            {#snippet children(intersecting)}
                <MessageBubble
                    {chatId}
                    {sender}
                    senderContext={msg.senderContext}
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
        {#if canUnpin}
            <Container
                width={"hug"}
                onClick={(e) => {
                    e?.stopPropagation();
                    unpinMessage();
                }}>
                <Caption width={"hug"} colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("unpinMessage")} />
                </Caption>
            </Container>
        {/if}
    </Container>
</Container>
