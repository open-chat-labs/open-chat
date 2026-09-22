<script lang="ts">
    import { IconButton, MenuItem, MenuTrigger, type Padding } from "component-lib";
    import { publish, type ChatIdentifier, type VideoCallType } from "@client";
    import Phone from "svelte-material-icons/PhoneOutline.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        chatId: ChatIdentifier;
        isPublic: boolean;
        videoCallInProgress: boolean;
        // when the user is already in this chat's call the button hangs up
        inCall?: boolean;
        size?: "xs" | "sm" | "md" | "lg";
        mode?: "transparent" | "dark" | "primary" | "secondary";
        padding?: Padding;
    }

    let {
        chatId,
        isPublic,
        videoCallInProgress,
        inCall = false,
        size = "md",
        mode = "transparent",
        padding = "sm",
    }: Props = $props();

    // a new call that is not a broadcast is offered as an audio call or a video call
    let canChooseCallType = $derived(!inCall && !videoCallInProgress && !isPublic);

    function start(callType: VideoCallType) {
        if (inCall) {
            publish("hangup");
        } else {
            publish("startVideoCall", { chatId, callType, join: videoCallInProgress });
        }
    }
</script>

{#snippet button(onclick?: () => void)}
    <IconButton {onclick} {size} {mode} {padding}>
        {#snippet icon(color)}
            <Video {color} />
        {/snippet}
    </IconButton>
{/snippet}

{#if canChooseCallType}
    <MenuTrigger position={"bottom"} align={"end"}>
        {@render button()}
        {#snippet menuItems()}
            <MenuItem onclick={() => start("audio")}>
                {#snippet icon(color, size)}
                    <Phone {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("videoCall.startAudio")} />
            </MenuItem>
            <MenuItem onclick={() => start("default")}>
                {#snippet icon(color, size)}
                    <Video {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("videoCall.startVideo")} />
            </MenuItem>
        {/snippet}
    </MenuTrigger>
{:else}
    {@render button(() => start(isPublic ? "broadcast" : "default"))}
{/if}
