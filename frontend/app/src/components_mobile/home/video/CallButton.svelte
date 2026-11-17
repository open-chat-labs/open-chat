<script lang="ts">
    import { IconButton, MenuItem, MenuTrigger, type Padding } from "component-lib";
    import { callOffer, publish, type ChatIdentifier, type OpenChat, type VideoCallType } from "@client";
    import { getContext } from "svelte";
    import { isIosTauriApp } from "@shared";
    import Phone from "svelte-material-icons/PhoneOutline.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";

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

    const client = getContext<OpenChat>("client");

    // the parent shows the button only where the user can start or join a call
    let offer = $derived(
        callOffer({
            canStart: true,
            isPublic,
            inProgress:
                videoCallInProgress || inCall
                    ? (client.lookupChatSummary(chatId)?.videoCallInProgress?.callType ?? "default")
                    : undefined,
            inCall,
            // iOS can watch a broadcast but not start one yet (#10445)
            canStartBroadcast: !isIosTauriApp(),
        }),
    );

    function start(callType: VideoCallType) {
        if (offer.kind === "leave") {
            publish("hangup");
        } else {
            publish("startVideoCall", { chatId, callType, join: offer.kind === "join" });
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

{#if offer.kind === "choose"}
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
{:else if offer.kind === "join"}
    {@render button(() => start(offer.callType))}
{:else if offer.kind !== "none"}
    {@render button(() => start("broadcast"))}
{/if}
