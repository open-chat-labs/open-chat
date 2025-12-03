<script lang="ts">
    import { MenuItem } from "component-lib";
    import {
        chatListScopeStore,
        OpenChat,
        pageReplace,
        publish,
        routeForMessage,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import WindowMinimize from "svelte-material-icons/WindowMinimize.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { activeVideoCall, hasPresence } from "../../../stores/video";
    import { removeQueryStringParam } from "../../../utils/urls";
    import Translatable from "../../Translatable.svelte";
    import type { VideoCallChat } from "./callChat";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: VideoCallChat;
        onAskToSpeak: () => void;
        onMinimise: () => void;
    }

    let { chat, onAskToSpeak, onMinimise }: Props = $props();

    let threadOpen = $derived($activeVideoCall?.threadOpen ?? false);
    let participantsOpen = $derived($activeVideoCall?.participantsOpen ?? false);
    let isOwner = $derived($activeVideoCall?.isOwner ?? false);

    function toggleThread() {
        if (chat.chatId !== undefined && chat.videoCallInProgress?.messageIndex !== undefined) {
            if (threadOpen) {
                client.popRightPanelHistory();
                pageReplace(removeQueryStringParam("open"));
            } else {
                page(
                    `${routeForMessage(
                        $chatListScopeStore.kind,
                        { chatId: chat.chatId },
                        chat.videoCallInProgress?.messageIndex,
                    )}?open=true`,
                );
            }
            activeVideoCall.threadOpen(!threadOpen);
        }
    }

    function toggleParticipants() {
        if (participantsOpen) {
            publish("closeModalPage");
        } else {
            if (
                $activeVideoCall?.messageId !== undefined &&
                $activeVideoCall.chatId.kind !== "direct_chat"
            ) {
                publish("showVideoCallParticipants", {
                    chatId: $activeVideoCall.chatId,
                    messageId: $activeVideoCall.messageId,
                    isOwner,
                });
            }
        }
        activeVideoCall.participantsOpen(!participantsOpen);
    }
</script>

{#if $activeVideoCall?.status === "joined"}
    {#if !$hasPresence}
        <MenuItem onclick={onAskToSpeak}>
            {#snippet icon(color, size)}
                <HandFrontLeft title={$_("videoCall.askToSpeak")} {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
        </MenuItem>
    {/if}
    {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
        <MenuItem onclick={toggleParticipants}>
            {#snippet icon(color, size)}
                <AccountMultiple {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("videoCall.showParticipants")} />
        </MenuItem>
    {/if}
    {#if chat.chatId && chat.videoCallInProgress?.messageIndex !== undefined}
        <MenuItem onclick={toggleThread}>
            {#snippet icon(color, size)}
                <MessageOutline {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("videoCall.chat")} />
        </MenuItem>
    {/if}
    <MenuItem onclick={onMinimise}>
        {#snippet icon(color, size)}
            <WindowMinimize {size} {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("videoCall.minimise")} />
    </MenuItem>
    <MenuItem onclick={() => publish("hangup")}>
        {#snippet icon(color, size)}
            <PhoneHangup {size} {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("videoCall.leave")} />
    </MenuItem>
{/if}
