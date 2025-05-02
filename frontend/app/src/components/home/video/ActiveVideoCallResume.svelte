<script lang="ts">
    import { app, chatIdentifiersEqual, ui } from "openchat-client";
    import { activeVideoCall } from "../../../stores/video";

    let show = $derived(
        ui.mobileWidth &&
            $activeVideoCall?.chatId !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, app.selectedChatId) &&
            $activeVideoCall.view === "minimised",
    );

    function resume() {
        activeVideoCall.setView("default");
    }
</script>

{#if show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={resume} class="video-call"></div>
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
