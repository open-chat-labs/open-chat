<script lang="ts">
    import {
        chatIdentifiersEqual,
        routeForMessage,
        type OpenChat,
        chatListScopeStore as chatListScope,
        selectedChatStore as selectedChat,
        selectedMessageContext,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Button from "../../Button.svelte";
    import { activeVideoCall } from "../../../stores/video";
    import page from "page";

    const client = getContext<OpenChat>("client");

    function join() {
        if (!incall && $selectedChat) {
            publish("startVideoCall", { chat: $selectedChat, join: true });
        }
    }

    function goto() {
        if (
            $selectedChat?.videoCallInProgress !== undefined &&
            $selectedMessageContext !== undefined
        ) {
            page(
                routeForMessage(
                    $chatListScope.kind,
                    $selectedMessageContext,
                    $selectedChat?.videoCallInProgress,
                ),
            );
        }
    }
    let hasCall = $derived(
        $selectedChat !== undefined && $selectedChat.videoCallInProgress !== undefined,
    );
    let isPublic = $derived($selectedChat !== undefined && !client.isChatPrivate($selectedChat));
    let incall = $derived(
        $activeVideoCall !== undefined &&
            $selectedChat !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, $selectedChat?.id),
    );
    let show = $derived(hasCall && isPublic && !incall);
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
