<script lang="ts">
    import { pageReplace, ui, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import WindowMaximize from "svelte-material-icons/WindowMaximize.svelte";
    import WindowMinimize from "svelte-material-icons/WindowMinimize.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { activeVideoCall, hasPresence } from "../../../stores/video";
    import { removeQueryStringParam } from "../../../utils/urls";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { VideoCallChat } from "./callChat";

    const client = getContext<OpenChat>("client");

    interface Props {
        askedToSpeak: boolean;
        chat: VideoCallChat;
        onAskToSpeak: () => void;
        onHangup: () => void;
        onMinimise: () => void;
        onToggleFullscreen: () => void;
    }

    let { askedToSpeak, chat, onAskToSpeak, onHangup, onMinimise, onToggleFullscreen }: Props =
        $props();

    let threadOpen = $derived($activeVideoCall?.threadOpen ?? false);
    let participantsOpen = $derived($activeVideoCall?.participantsOpen ?? false);
    let isOwner = $derived($activeVideoCall?.isOwner ?? false);

    function toggleThread() {
        if (chat.chatId !== undefined && chat.messageIndex !== undefined) {
            if (threadOpen) {
                ui.popRightPanelHistory();
                pageReplace(removeQueryStringParam("open"));
            } else {
                client.openThreadFromMessageIndex(chat.chatId, chat.messageIndex);
            }
            activeVideoCall.threadOpen(!threadOpen);
        }
    }

    function toggleParticipants() {
        if (participantsOpen) {
            ui.popRightPanelHistory();
        } else {
            if (
                $activeVideoCall?.messageId !== undefined &&
                $activeVideoCall.chatId.kind !== "direct_chat"
            ) {
                ui.rightPanelHistory = [
                    {
                        kind: "call_participants_panel",
                        chatId: $activeVideoCall.chatId,
                        messageId: $activeVideoCall.messageId,
                        isOwner,
                    },
                ];
            }
        }
        activeVideoCall.participantsOpen(!participantsOpen);
    }
</script>

{#if ui.mobileWidth}
    {#if $activeVideoCall?.status === "joined"}
        <MenuIcon position={"bottom"} align={"end"}>
            {#snippet menuIcon()}
                <HoverIcon title={$_("chatMenu")}>
                    <DotsVertical size={ui.iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            {/snippet}
            {#snippet menuItems()}
                <Menu>
                    {#if !$hasPresence}
                        <MenuItem onclick={onAskToSpeak}>
                            {#snippet icon()}
                                <HandFrontLeft
                                    title={$_("videoCall.askToSpeak")}
                                    size={ui.iconSize}
                                    color={askedToSpeak
                                        ? "var(--icon-selected)"
                                        : "var(--icon-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
                        <MenuItem onclick={toggleParticipants}>
                            {#snippet icon()}
                                <AccountMultiple
                                    size={ui.iconSize}
                                    color={participantsOpen
                                        ? "var(--icon-selected)"
                                        : "var(--icon-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("videoCall.showParticipants")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if chat.chatId && chat.messageIndex !== undefined}
                        <MenuItem onclick={toggleThread}>
                            {#snippet icon()}
                                <MessageOutline
                                    size={ui.iconSize}
                                    color={threadOpen
                                        ? "var(--icon-selected)"
                                        : "var(--icon-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("videoCall.chat")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    <MenuItem onclick={onMinimise}>
                        {#snippet icon()}
                            <WindowMinimize size={ui.iconSize} color={"var(--icon-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={i18nKey("videoCall.minimise")} />
                        {/snippet}
                    </MenuItem>
                    <MenuItem onclick={onHangup}>
                        {#snippet icon()}
                            <PhoneHangup size={ui.iconSize} color={"var(--vote-no-color)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={i18nKey("videoCall.leave")} />
                        {/snippet}
                    </MenuItem>
                </Menu>
            {/snippet}
        </MenuIcon>
    {/if}
{:else}
    <div class:joining={$activeVideoCall?.status === "joining"} class="actions">
        {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
            <HoverIcon onclick={onAskToSpeak}>
                <HandFrontLeft
                    title={$_("videoCall.askToSpeak")}
                    size={ui.iconSize}
                    color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
            <HoverIcon title={$_("videoCall.showParticipants")} onclick={toggleParticipants}>
                <AccountMultiple
                    size={ui.iconSize}
                    color={participantsOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if chat.chatId && chat.messageIndex !== undefined}
            <HoverIcon title={$_("videoCall.chat")} onclick={toggleThread}>
                <MessageOutline
                    size={ui.iconSize}
                    color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        <HoverIcon onclick={onMinimise}>
            <WindowMinimize size={ui.iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon onclick={onToggleFullscreen}>
            <WindowMaximize size={ui.iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon title={$_("videoCall.leave")} onclick={onHangup}>
            <PhoneHangup size={ui.iconSize} color={"var(--vote-no-color)"} />
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
