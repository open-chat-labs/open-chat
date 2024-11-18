<script lang="ts">
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Typing from "../../Typing.svelte";
    import { AvatarSize } from "openchat-client";
    import { activeVideoCall } from "../../../stores/video";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Avatar from "../../Avatar.svelte";
    import ActiveCallActions from "./ActiveCallActions.svelte";
    import type { VideoCallChat } from "./callChat";

    interface Props {
        askedToSpeak: boolean;
        chat: VideoCallChat;
        onClearSelection: () => void;
        onAskToSpeak: () => void;
        onHangup: () => void;
    }

    let { askedToSpeak, chat, onClearSelection, onAskToSpeak, onHangup }: Props = $props();

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
</script>

<SectionHeader shadow flush>
    <div class="header">
        {#if $mobileWidth}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                tabindex="0"
                role="button"
                class="back"
                class:rtl={$rtlStore}
                onclick={onClearSelection}>
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

        <ActiveCallActions
            {chat}
            {askedToSpeak}
            {onAskToSpeak}
            onMinimise={minimise}
            onToggleFullscreen={toggleFullscreen}
            {onHangup} />
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
    }
</style>
