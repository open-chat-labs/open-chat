<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";

    export let controller: ChatController;
    export let blocked: boolean;

    let confirmDelete = false;
    let deleting = false;

    // todo - I suspect this is not going to be reactive in the way that we want
    $: unreadMessages = controller.unreadMessageCount;

    function toggleMuteNotifications() {
        const op = controller.notificationsMuted ? "unmuted" : "muted";
        controller.api
            .toggleMuteNotifications(controller.chatId, !controller.notificationsMuted)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                        values: { operation: $_(op) },
                    });
                } else {
                    toastStore.showSuccessToast("toggleMuteNotificationsSucceeded", {
                        values: { operation: $_(op) },
                    });
                }
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
                toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                    values: { operation: $_(op) },
                });
            });
    }

    function markAllRead() {
        controller.markAllRead();
    }

    function messageRead(
        ev: CustomEvent<{ chatId: string; messageIndex: number; messageId: bigint }>
    ) {
        controller.messageRead(ev.detail.messageIndex, ev.detail.messageId);
    }

    function deleteGroup() {
        deleting = true;
        controller
            .deleteGroup()
            .then((deleted) => {
                if (deleted) {
                    toastStore.showSuccessToast("deleteGroupSuccess");
                } else {
                    toastStore.showFailureToast("deleteGroupFailure");
                }
            })
            .finally(() => (confirmDelete = deleting = false));
    }

    $: chat = controller.chat;
</script>

<div class="wrapper">
    <CurrentChatHeader
        {blocked}
        {unreadMessages}
        on:clearSelection
        on:blockUser
        on:unblockUser
        on:markAllRead={markAllRead}
        on:toggleMuteNotifications={toggleMuteNotifications}
        on:addParticipants
        on:showGroupDetails
        on:showParticipants
        on:leaveGroup
        on:deleteGroup={() => (confirmDelete = true)}
        selectedChatSummary={chat} />
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:messageRead={messageRead}
        on:chatWith
        {controller}
        {unreadMessages} />
    <Footer {blocked} {controller} />
</div>

<Overlay bind:active={confirmDelete}>
    <ModalContent fill={true}>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p class="msg">
                {$_("irreversible")}
            </p>
        </span>
        <span slot="footer">
            <div class="buttons">
                <Button loading={deleting} disabled={deleting} small={true} on:click={deleteGroup}
                    >{$_("yesPlease")}</Button>
                <Button
                    disabled={deleting}
                    small={true}
                    on:click={() => (confirmDelete = false)}
                    secondary={true}>{$_("noThanks")}</Button>
            </div>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
    .msg {
        padding: $sp5;
    }
    .buttons {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }
</style>
