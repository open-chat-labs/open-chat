<script lang="ts">
    import { ring } from "../../../utils/ring";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { rtlStore } from "../../../stores/rtl";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import ArrowCollapse from "svelte-material-icons/ArrowCollapse.svelte";
    import {
        chatIdentifiersEqual,
        type ChatSummary,
        OpenChat,
        type ChatIdentifier,
        AvatarSize,
        type AccessTokenType,
    } from "openchat-client";
    import { activeVideoCall, camera, microphone, sharing } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import type { Theme } from "../../../theme/types";
    import type { DailyThemeConfig } from "@daily-co/daily-js";
    import daily from "@daily-co/daily-js";
    import AreYouSure from "../../AreYouSure.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Avatar from "../../Avatar.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import { filterRightPanelHistory } from "../../../stores/rightPanel";
    import { removeQueryStringParam } from "../../../utils/urls";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Typing from "../../Typing.svelte";
    import ActiveCallThreadSummary from "./ActiveCallThreadSummary.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: selectedChatId = client.selectedChatId;
    $: communities = client.communities;
    $: userStore = client.userStore;
    $: user = client.user;
    $: chat = normaliseChatSummary($activeVideoCall?.chatId);
    $: threadOpen = $activeVideoCall?.threadOpen ?? false;

    let iframeContainer: HTMLDivElement;
    let confirmSwitchTo: { chat: ChatSummary; join: boolean } | undefined = undefined;

    $: {
        activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    }

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = client.lookupChatSummary(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = $userStore[chat.them.userId];
                        return {
                            chatId: chat.id,
                            name: client.displayName(them),
                            avatarUrl: client.userAvatarUrl(them),
                            userId: chat.them,
                            messageIndex: chat.videoCallInProgress,
                        };
                    case "group_chat":
                        return {
                            chatId: chat.id,
                            name: chat.name,
                            avatarUrl: client.groupAvatarUrl(chat),
                            userId: undefined,
                            messageIndex: chat.videoCallInProgress,
                        };
                    case "channel":
                        return {
                            chatId: chat.id,
                            name: `${
                                $communities.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat),
                            userId: undefined,
                            messageIndex: chat.videoCallInProgress,
                        };
                }
            }
        }
    }

    export async function startOrJoinVideoCall(chat: ChatSummary, join: boolean) {
        if (chat === undefined) return;

        try {
            ring.pause();

            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = { chat, join };
                return;
            }

            performance.mark("start");

            // close and threads we have open in the right panel
            filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            removeQueryStringParam("open");

            activeVideoCall.joining(chat.id);

            const accessType: AccessTokenType = join
                ? { kind: "join_video_call" }
                : { kind: "start_video_call" };

            // first we need to get access jwt from the oc backend
            const { token, roomName, messageId, joining } = await client.getVideoChatAccessToken(
                chat.id,
                accessType,
            );

            performance.mark("daily_token");
            performance.measure("get_oc_token", "start", "oc_token");
            performance.measure("get_daily_token", "oc_token", "daily_token");

            const call = daily.createFrame(iframeContainer, {
                token,
                activeSpeakerMode: false,
                showLeaveButton: false,
                showFullscreenButton: false,
                iframeStyle: {
                    width: "100%",
                    height: "100%",
                },
                url: `https://openchat.daily.co/${roomName}`,
                userName: $user.username,
                theme: getThemeConfig($currentTheme),
            });

            performance.mark("daily_frame");

            call.on("left-meeting", async () => {
                activeVideoCall.endCall();
            });

            call.on("participant-updated", (ev) => {
                if (ev?.participant.local) {
                    microphone.set(ev?.participant.tracks.audio.state !== "off");
                    camera.set(ev?.participant.tracks.video.state !== "off");
                    sharing.set(ev?.participant.tracks.screenVideo.state !== "off");
                }
            });

            // if we are not joining aka starting we need to tell the other users
            if (!joining) {
                client.ringOtherUsers();
            }

            await call.join();

            performance.mark("daily_joined");
            performance.measure("get_daily_frame", "daily_token", "daily_frame");
            performance.measure("get_daily_joined", "daily_frame", "daily_joined");

            activeVideoCall.setCall(chat.id, call);

            performance.mark("end");
            performance.measure("total", "start", "end");

            console.log("OCToken: ", performance.getEntriesByName("get_oc_token"));
            console.log("DailyToken: ", performance.getEntriesByName("get_daily_token"));
            console.log("DailyFrame: ", performance.getEntriesByName("get_daily_frame"));
            console.log("DailyJoined: ", performance.getEntriesByName("get_daily_joined"));
            console.log("Total: ", performance.getEntriesByName("total"));

            if (joining) {
                await client.joinVideoCall(chat.id, BigInt(messageId));
            }
        } catch (err) {
            toastStore.showFailureToast(i18nKey("videoCall.callFailed"), err);
            activeVideoCall.endCall();
            console.error("Unable to start video call: ", err);
        }
    }

    function getThemeConfig(theme: Theme): DailyThemeConfig {
        const dailyTheme = {
            colors: {
                accent: `${theme.daily.accent}`,
                accentText: `${theme.daily.accentText}`,
                background: `${theme.daily.background}`,
                backgroundAccent: `${theme.daily.backgroundAccent}`,
                baseText: `${theme.daily.baseText}`,
                border: `${theme.daily.border}`,
                mainAreaBg: `${theme.daily.mainAreaBg}`,
                mainAreaBgAccent: `${theme.daily.mainAreaBgAccent}`,
                mainAreaText: `${theme.daily.mainAreaText}`,
                supportiveText: `${theme.daily.supportiveText}`,
            },
        };
        return dailyTheme;
    }

    function switchCall(confirmed: boolean): Promise<void> {
        if (confirmed && confirmSwitchTo) {
            activeVideoCall.endCall();
            const { chat, join } = confirmSwitchTo;
            confirmSwitchTo = undefined;
            return startOrJoinVideoCall(chat, join);
        }
        confirmSwitchTo = undefined;
        return Promise.resolve();
    }

    function toggleFullscreen() {
        if ($activeVideoCall) {
            activeVideoCall.fullscreen(!$activeVideoCall.fullscreen);
        }
    }

    function hangup() {
        activeVideoCall.endCall();
    }

    function clearSelection() {
        dispatch("clearSelection");
    }

    export function closeThread() {
        activeVideoCall.threadOpen(false);
    }
</script>

{#if confirmSwitchTo}
    <AreYouSure message={i18nKey("videoCall.switchCall")} action={switchCall} />
{/if}

<div
    id="video-call-container"
    class="video-call-container"
    class:visible={$activeVideoCall &&
        !(threadOpen && $mobileWidth) &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId)}>
    {#if chat !== undefined}
        <SectionHeader shadow flush>
            <div class="header">
                {#if $mobileWidth}
                    <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
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
                    {#if chat.chatId && chat.messageIndex !== undefined}
                        <ActiveCallThreadSummary
                            chatId={chat.chatId}
                            messageIndex={chat.messageIndex} />
                    {/if}
                    <HoverIcon title={$_("videoCall.leave")} on:click={hangup}>
                        <PhoneHangup size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                    {#if !$mobileWidth}
                        <HoverIcon on:click={toggleFullscreen}>
                            {#if $activeVideoCall?.fullscreen}
                                <ArrowCollapse size={$iconSize} color={"var(--icon-txt)"} />
                            {:else}
                                <ArrowExpand size={$iconSize} color={"var(--icon-txt)"} />
                            {/if}
                        </HoverIcon>
                    {/if}
                </div>
            </div>
        </SectionHeader>
    {/if}
    <div class="iframe-container" bind:this={iframeContainer}></div>
</div>

<style lang="scss">
    :global(.video-call-container .section-header) {
        background-color: var(--daily-header);
    }

    .video-call-container {
        position: absolute;
        display: none;
        flex-direction: column;
        @include z-index("video-call");

        &.visible {
            display: flex;
        }
    }

    .iframe-container {
        height: 100%;
    }

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
