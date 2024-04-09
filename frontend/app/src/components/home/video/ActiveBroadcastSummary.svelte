<script lang="ts">
    import { chatIdentifiersEqual, type OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Button from "../../Button.svelte";
    import { activeVideoCall } from "../../../stores/video";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: selectedChat = client.selectedChatStore;
    $: hasCall = $selectedChat !== undefined && $selectedChat.videoCallInProgress !== undefined;
    $: isPublic = $selectedChat !== undefined && !client.isChatPrivate($selectedChat);
    $: show = hasCall && isPublic;
    $: incall =
        $activeVideoCall !== undefined &&
        $selectedChat !== undefined &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChat?.id);

    function join() {
        if (!incall && $selectedChat) {
            dispatch("startVideoCall", { chat: $selectedChat, join: true });
        }
    }
</script>

{#if show}
    <div class="active-broadcast">
        <Translatable resourceKey={i18nKey("videoCall.broadcastCallInProgress")} />
        <Button on:click={join} tiny hollow>
            <Translatable resourceKey={i18nKey("videoCall.join")} />
        </Button>
    </div>
{/if}

<style lang="scss">
    .active-broadcast {
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
        @include box-shadow(2);
    }
</style>
