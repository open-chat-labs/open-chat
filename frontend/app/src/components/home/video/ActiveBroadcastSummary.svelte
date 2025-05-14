<script lang="ts">
    import {
        app,
        chatIdentifiersEqual,
        publish,
        routeForMessage,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { activeVideoCall } from "../../../stores/video";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    function join() {
        if (!inCall && app.selectedChatSummary) {
            publish("startVideoCall", { chatId: app.selectedChatSummary.id, callType: "broadcast", join: true });
        }
    }

    function goto() {
        if (app.selectedChatSummary?.videoCallInProgress !== undefined) {
            page(
                routeForMessage(
                    app.chatListScope.kind,
                    { chatId: app.selectedChatSummary.id },
                    app.selectedChatSummary?.videoCallInProgress.messageIndex,
                ),
            );
        }
    }
    let hasCall = $derived(
        app.selectedChatSummary !== undefined &&
            app.selectedChatSummary.videoCallInProgress !== undefined,
    );
    let isPublic = $derived(
        app.selectedChatSummary !== undefined && !client.isChatPrivate(app.selectedChatSummary),
    );
    let inCall = $derived(
        $activeVideoCall !== undefined &&
            app.selectedChatSummary !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, app.selectedChatSummary?.id),
    );
    let show = $derived(hasCall && isPublic && !inCall);
</script>

{#if show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div role="button" tabindex="0" onclick={goto} class="active-broadcast">
        <Translatable resourceKey={i18nKey("videoCall.broadcastCallInProgress")} />
        <Button onClick={join} tiny hollow>
            <Translatable resourceKey={i18nKey("videoCall.join")} />
        </Button>
    </div>
{/if}

<style lang="scss">
    :global(.active-broadcast button.hollow) {
        border-color: var(--notificationBar-txt);
        color: var(--notificationBar-txt);
        background-color: var(--notificationBar-bg);
    }

    .active-broadcast {
        cursor: pointer;
        position: absolute;
        display: flex;
        justify-content: space-between;
        align-items: center;
        top: toRem(80);
        left: 0;
        right: 0;
        width: 100%;
        padding: $sp4;
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        @include box-shadow(2);
    }
</style>
