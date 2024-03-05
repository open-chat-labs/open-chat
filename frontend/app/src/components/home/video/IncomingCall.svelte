<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import VideoCallIcon from "./VideoCallIcon.svelte";
    import { incomingVideoCall } from "../../../stores/video";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: userStore = client.userStore;

    function join() {
        if ($incomingVideoCall !== undefined) {
            dispatch("join", $incomingVideoCall.chatId);
        }
    }

    function cancel() {
        incomingVideoCall.set(undefined);
    }
</script>

{#if $incomingVideoCall !== undefined}
    <audio
        playsinline={true}
        autoplay={true}
        src="/assets/ringring.mp3"
        muted={false}
        preload="auto"></audio>

    <Overlay on:close={() => dispatch("cancel")} dismissible>
        <ModalContent closeIcon>
            <span slot="header">
                <VideoCallIcon />
                <Translatable resourceKey={i18nKey("videoCall.incoming")} />
            </span>
            <span slot="body">
                Video call started by {$userStore[$incomingVideoCall.userId].username}
            </span>
            <span slot="footer">
                <ButtonGroup>
                    <Button on:click={cancel} secondary>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button on:click={join}>
                        <Translatable resourceKey={i18nKey("videoCall.join")} />
                    </Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
</style>
