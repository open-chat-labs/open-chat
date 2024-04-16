<script lang="ts">
    import { _ } from "svelte-i18n";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import WindowMaximize from "svelte-material-icons/WindowMaximize.svelte";
    import WindowMinimize from "svelte-material-icons/WindowMinimize.svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import SectionHeader from "../../SectionHeader.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Typing from "../../Typing.svelte";
    import {
        AvatarSize,
        OpenChat,
        type ChatIdentifier,
        type DirectChatIdentifier,
    } from "openchat-client";
    import { activeVideoCall, hasPresence } from "../../../stores/video";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Avatar from "../../Avatar.svelte";
    import ActiveCallThreadSummary from "./ActiveCallThreadSummary.svelte";
    import ActiveCallParticipantsToggle from "./ActiveCallParticipantsToggle.svelte";

    type Chat = {
        chatId: ChatIdentifier;
        name: string;
        avatarUrl: string;
        userId: DirectChatIdentifier | undefined;
        messageIndex?: number;
    };

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let askedToSpeak: boolean;
    export let chat: Chat;

    $: user = client.user;

    function clearSelection() {
        dispatch("clearSelection");
    }

    function minimise() {
        activeVideoCall.setView("minimised");
    }

    function toggleFullscreen() {
        if ($activeVideoCall?.view === "default") {
            activeVideoCall.setView("fullscreen");
        } else if ($activeVideoCall?.view === "fullscreen") {
            activeVideoCall.setView("default");
        }
    }

    export function askToSpeak() {
        // we need to send a message to all of the current admins on the call to and send our userId and our participantId
        if ($activeVideoCall?.call) {
            const participants = $activeVideoCall.call.participants();
            const me = participants.local;
            Object.entries(participants).map(([key, val]) => {
                if (key !== "local") {
                    if (val.permissions.hasPresence && val.permissions.canAdmin) {
                        askedToSpeak = true;
                        $activeVideoCall?.call?.sendAppMessage(
                            {
                                kind: "ask_to_speak",
                                participantId: me.session_id,
                                userId: $user.userId,
                            },
                            val.session_id,
                        );
                    }
                }
            });
        }
    }
</script>

<SectionHeader shadow flush>
    <div class="header">
        {#if $mobileWidth}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
                tabindex="0"
                role="button"
                class="back"
                class:rtl={$rtlStore}
                on:click={clearSelection}>
                <HoverIcon>
                    {#if $rtlStore}
                        <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                    {:else}
                        <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                    {/if}
                </HoverIcon>
            </div>
        {/if}
        <div class="details">
            {#if $activeVideoCall?.status === "joining"}
                <div class="joining">
                    <FancyLoader loop />
                </div>
            {:else}
                <div class="avatar">
                    <Avatar
                        statusBorder={"var(--section-bg)"}
                        url={chat.avatarUrl}
                        showStatus
                        userId={chat.userId?.userId}
                        size={AvatarSize.Default} />
                </div>
            {/if}
            <h2 class="name">{chat.name}</h2>
            {#if $activeVideoCall?.status === "joining"}
                <Typing />
            {/if}
        </div>
        <div class:joining={$activeVideoCall?.status === "joining"} class="actions">
            {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
                <HoverIcon on:click={askToSpeak}>
                    <HandFrontLeft
                        title={$_("videoCall.askToSpeak")}
                        size={$iconSize}
                        color={askedToSpeak ? "var(--icon-selected)" : "var(--icon-txt)"} />
                </HoverIcon>
            {/if}
            {#if chat.chatId && chat.messageIndex !== undefined}
                <ActiveCallParticipantsToggle
                    chatId={chat.chatId}
                    messageIndex={chat.messageIndex} />
            {/if}
            {#if chat.chatId && chat.messageIndex !== undefined}
                <ActiveCallThreadSummary chatId={chat.chatId} messageIndex={chat.messageIndex} />
            {/if}
            <HoverIcon on:click={minimise}>
                <WindowMinimize size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
            {#if !$mobileWidth}
                <HoverIcon on:click={toggleFullscreen}>
                    <WindowMaximize size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            {/if}
            <HoverIcon title={$_("videoCall.leave")} on:click={() => dispatch("hangup")}>
                <PhoneHangup size={$iconSize} color={"var(--vote-no-color)"} />
            </HoverIcon>
        </div>
    </div>
</SectionHeader>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp3;
        width: 100%;

        .details {
            display: flex;
            align-items: center;
            gap: $sp4;
            flex: auto;

            .joining {
                width: toRem(48);
                height: toRem(48);
            }
        }

        .name {
            @include font(book, normal, fs-120);
            @include ellipsis();
        }

        .actions {
            display: flex;
            align-items: center;
            gap: $sp3;

            &.joining {
                pointer-events: none;
            }
        }
    }
</style>
