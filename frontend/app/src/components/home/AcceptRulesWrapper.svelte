<script lang="ts">
    import { getContext } from "svelte";
    import type {
        AttachmentContent,
        EventWrapper,
        Message,
        MessageContent,
        MessageContext,
        OpenChat,
        User,
    } from "openchat-client";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";

    type ConfirmedActionEvent =
        | ConfirmedSendMessage
        | ConfirmedSendMessageWithContent
        | ConfirmedForwardMessage
        | ConfirmedRetrySendMessage;

    type ConfirmedSendMessage = {
        kind: "send_message";
        textContent: string | undefined;
        mentioned: User[];
        attachment: AttachmentContent | undefined;
    };

    type ConfirmedSendMessageWithContent = {
        kind: "send_message_with_content";
        content: MessageContent;
        mentioned: User[];
    };

    type ConfirmedForwardMessage = {
        kind: "forward_message";
        msg: Message;
    };

    type ConfirmedRetrySendMessage = {
        kind: "retry_send_message";
        event: EventWrapper<Message>;
    };

    const client = getContext<OpenChat>("client");

    export let messageContext: MessageContext;

    $: canSendAny = client.canSendMessage(
        messageContext.chatId,
        messageContext.threadRootMessageIndex !== undefined ? "thread" : "message",
    );

    let showAcceptRulesModal = false;
    let sendMessageContext: ConfirmedActionEvent | undefined = undefined;

    function sendMessageWithContent(ev: CustomEvent<{ content: MessageContent }>): void {
        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "send_message_with_content",
                content: ev.detail.content,
                mentioned: [],
            };
        } else {
            client.sendMessageWithContent(messageContext, ev.detail.content);
        }
    }

    function sendMessageWithAttachment(
        ev: CustomEvent<{
            textContent: string | undefined;
            attachment: AttachmentContent | undefined;
            mentioned: User[];
        }>,
    ) {
        const { textContent, attachment, mentioned } = ev.detail;
        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "send_message",
                textContent,
                mentioned,
                attachment,
            };
        } else {
            client.sendMessageWithAttachment(messageContext, textContent, attachment, mentioned);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        if (!canSendAny || !client.canForward(ev.detail.content)) return;

        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "forward_message",
                msg: ev.detail,
            };
        } else {
            client.forwardMessage(messageContext, ev.detail);
        }
    }

    function retrySend(ev: CustomEvent<EventWrapper<Message>>): void {
        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "retry_send_message",
                event: ev.detail,
            };
        } else {
            client.retrySendMessage(messageContext, ev.detail);
        }
    }

    function onAcceptRules(
        ev: CustomEvent<{
            accepted: boolean;
            chatRulesVersion: number | undefined;
            communityRulesVersion: number | undefined;
        }>,
    ) {
        if (sendMessageContext === undefined) {
            showAcceptRulesModal = false;
            return;
        }

        const { accepted, chatRulesVersion, communityRulesVersion } = ev.detail;

        if (accepted) {
            switch (sendMessageContext.kind) {
                case "send_message": {
                    client.sendMessageWithAttachment(
                        messageContext,
                        sendMessageContext.textContent,
                        sendMessageContext.attachment,
                        sendMessageContext.mentioned,
                        chatRulesVersion,
                        communityRulesVersion,
                    );
                    break;
                }

                case "send_message_with_content":
                    client.sendMessageWithContent(
                        messageContext,
                        sendMessageContext.content,
                        sendMessageContext.mentioned,
                        false,
                        chatRulesVersion,
                        communityRulesVersion,
                    );
                    break;

                case "forward_message": {
                    client.forwardMessage(
                        messageContext,
                        sendMessageContext.msg,
                        chatRulesVersion,
                        communityRulesVersion,
                    );
                    break;
                }
                case "retry_send_message": {
                    client.retrySendMessage(
                        messageContext,
                        sendMessageContext.event,
                        chatRulesVersion,
                        communityRulesVersion,
                    );
                    break;
                }
            }
        }

        sendMessageContext = undefined;
        showAcceptRulesModal = false;
    }
</script>

{#if showAcceptRulesModal}
    <AcceptRulesModal on:close={onAcceptRules} />
{/if}

<slot {sendMessageWithContent} {sendMessageWithAttachment} {forwardMessage} {retrySend} />
