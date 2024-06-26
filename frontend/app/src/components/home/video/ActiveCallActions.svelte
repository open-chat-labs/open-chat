<script lang="ts">
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import WindowMaximize from "svelte-material-icons/WindowMaximize.svelte";
    import WindowMinimize from "svelte-material-icons/WindowMinimize.svelte";
    import { activeVideoCall, hasPresence } from "../../../stores/video";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { createEventDispatcher, getContext } from "svelte";
    import type { VideoCallChat } from "./callChat";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { OpenChat } from "openchat-client";
    import { popRightPanelHistory, rightPanelHistory } from "../../../stores/rightPanel";
    import { pageReplace } from "../../../routes";
    import { removeQueryStringParam } from "../../../utils/urls";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let askedToSpeak: boolean;
    export let chat: VideoCallChat;

    $: threadOpen = $activeVideoCall?.threadOpen ?? false;
    $: participantsOpen = $activeVideoCall?.participantsOpen ?? false;
    $: isOwner = $activeVideoCall?.isOwner ?? false;

    function toggleThread() {
        if (chat.chatId !== undefined && chat.messageIndex !== undefined) {
            if (threadOpen) {
                popRightPanelHistory();
                pageReplace(removeQueryStringParam("open"));
            } else {
                client.openThreadFromMessageIndex(chat.chatId, chat.messageIndex);
            }
            activeVideoCall.threadOpen(!threadOpen);
        }
    }

    function toggleParticipants() {
        if (participantsOpen) {
            popRightPanelHistory();
        } else {
            if (
                $activeVideoCall?.messageId !== undefined &&
                $activeVideoCall.chatId.kind !== "direct_chat"
            ) {
                rightPanelHistory.set([
                    {
                        kind: "call_participants_panel",
                        chatId: $activeVideoCall.chatId,
                        messageId: $activeVideoCall.messageId,
                        isOwner,
                    },
                ]);
            }
        }
        activeVideoCall.participantsOpen(!participantsOpen);
    }
</script>

{#if $mobileWidth}
    {#if $activeVideoCall?.status === "joined"}
        <MenuIcon position={"bottom"} align={"end"}>
            <div slot="icon">
                <HoverIcon title={$_("chatMenu")}>
                    <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
            <div slot="menu">
                <Menu>
                    {#if !$hasPresence}
                        <MenuItem on:click={() => dispatch("askToSpeak")}>
                            <HandFrontLeft
                                slot="icon"
                                title={$_("videoCall.askToSpeak")}
                                size={$iconSize}
                                color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
                            </div>
                        </MenuItem>
                    {/if}
                    {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
                        <MenuItem on:click={toggleParticipants}>
                            <AccountMultiple
                                slot="icon"
                                size={$iconSize}
                                color={participantsOpen
                                    ? "var(--icon-selected)"
                                    : "var(--icon-txt)"} />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("videoCall.showParticipants")} />
                            </div>
                        </MenuItem>
                    {/if}
                    {#if chat.chatId && chat.messageIndex !== undefined}
                        <MenuItem on:click={toggleThread}>
                            <MessageOutline
                                slot="icon"
                                size={$iconSize}
                                color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("videoCall.chat")} />
                            </div>
                        </MenuItem>
                    {/if}
                    <MenuItem on:click={() => dispatch("minimise")}>
                        <WindowMinimize slot="icon" size={$iconSize} color={"var(--icon-txt)"} />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("videoCall.minimise")} />
                        </div>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("hangup")}>
                        <PhoneHangup slot="icon" size={$iconSize} color={"var(--vote-no-color)"} />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("videoCall.leave")} />
                        </div>
                    </MenuItem>
                </Menu>
            </div>
        </MenuIcon>
    {/if}
{:else}
    <div class:joining={$activeVideoCall?.status === "joining"} class="actions">
        {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
            <HoverIcon on:click={() => dispatch("askToSpeak")}>
                <HandFrontLeft
                    title={$_("videoCall.askToSpeak")}
                    size={$iconSize}
                    color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
            <HoverIcon title={$_("videoCall.showParticipants")} on:click={toggleParticipants}>
                <AccountMultiple
                    size={$iconSize}
                    color={participantsOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if chat.chatId && chat.messageIndex !== undefined}
            <HoverIcon title={$_("videoCall.chat")} on:click={toggleThread}>
                <MessageOutline
                    size={$iconSize}
                    color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        <HoverIcon on:click={() => dispatch("minimise")}>
            <WindowMinimize size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon on:click={() => dispatch("toggleFullScreen")}>
            <WindowMaximize size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon title={$_("videoCall.leave")} on:click={() => dispatch("hangup")}>
            <PhoneHangup size={$iconSize} color={"var(--vote-no-color)"} />
        </HoverIcon>
    </div>
{/if}

<style lang="scss">
    .actions {
        display: flex;
        align-items: center;
        gap: $sp3;

        &.joining {
            pointer-events: none;
        }
    }
</style>
