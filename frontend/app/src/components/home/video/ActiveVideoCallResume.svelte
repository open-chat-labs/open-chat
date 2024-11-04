<script lang="ts">
    import { chatIdentifiersEqual, selectedChatId } from "openchat-client";
    import { activeVideoCall } from "../../../stores/video";
    import { mobileWidth } from "../../../stores/screenDimensions";

    $: show =
        $mobileWidth &&
        $activeVideoCall?.chatId !== undefined &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId) &&
        $activeVideoCall.view === "minimised";

    function resume() {
        activeVideoCall.setView("default");
    }
</script>

{#if show}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click={resume} class="video-call"></div>
{/if}

<style lang="scss">
    .video-call {
        $size: 23px;
        width: $size;
        height: $size;
        border-radius: 50%;
        cursor: pointer;
        background-image: url("/assets/video_call.svg");
    }
</style>
