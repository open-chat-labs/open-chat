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
    import { getContext } from "svelte";
    import type { VideoCallChat } from "./callChat";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { OpenChat } from "openchat-client";
    import { popRightPanelHistory, rightPanelHistory } from "../../../stores/rightPanel";
    import { pageReplace } from "../../../routes";
    import { removeQueryStringParam } from "../../../utils/urls";

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
                        <MenuItem onclick={onAskToSpeak}>
                            <HandFrontLeft
                                slot="icon"
                                title={$_("videoCall.askToSpeak")}
                                size={$iconSize}
                                color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
                            <Translatable
                                slot="text"
                                resourceKey={i18nKey("videoCall.askToSpeak")} />
                        </MenuItem>
                    {/if}
                    {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
                        <MenuItem onclick={toggleParticipants}>
                            <AccountMultiple
                                slot="icon"
                                size={$iconSize}
                                color={participantsOpen
                                    ? "var(--icon-selected)"
                                    : "var(--icon-txt)"} />
                            <Translatable
                                slot="text"
                                resourceKey={i18nKey("videoCall.showParticipants")} />
                        </MenuItem>
                    {/if}
                    {#if chat.chatId && chat.messageIndex !== undefined}
                        <MenuItem onclick={toggleThread}>
                            <MessageOutline
                                slot="icon"
                                size={$iconSize}
                                color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
                            <Translatable slot="text" resourceKey={i18nKey("videoCall.chat")} />
                        </MenuItem>
                    {/if}
                    <MenuItem onclick={onMinimise}>
                        <WindowMinimize slot="icon" size={$iconSize} color={"var(--icon-txt)"} />
                        <Translatable slot="text" resourceKey={i18nKey("videoCall.minimise")} />
                    </MenuItem>
                    <MenuItem onclick={onHangup}>
                        <PhoneHangup slot="icon" size={$iconSize} color={"var(--vote-no-color)"} />
                        <Translatable slot="text" resourceKey={i18nKey("videoCall.leave")} />
                    </MenuItem>
                </Menu>
            </div>
        </MenuIcon>
    {/if}
{:else}
    <div class:joining={$activeVideoCall?.status === "joining"} class="actions">
        {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
            <HoverIcon onclick={onAskToSpeak}>
                <HandFrontLeft
                    title={$_("videoCall.askToSpeak")}
                    size={$iconSize}
                    color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if $activeVideoCall?.messageId !== undefined && $activeVideoCall.chatId.kind !== "direct_chat"}
            <HoverIcon title={$_("videoCall.showParticipants")} onclick={toggleParticipants}>
                <AccountMultiple
                    size={$iconSize}
                    color={participantsOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        {#if chat.chatId && chat.messageIndex !== undefined}
            <HoverIcon title={$_("videoCall.chat")} onclick={toggleThread}>
                <MessageOutline
                    size={$iconSize}
                    color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
        <HoverIcon onclick={onMinimise}>
            <WindowMinimize size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon onclick={onToggleFullscreen}>
            <WindowMaximize size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon title={$_("videoCall.leave")} onclick={onHangup}>
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
