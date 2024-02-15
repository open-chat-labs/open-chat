<script lang="ts">
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import ArrowCollapse from "svelte-material-icons/ArrowCollapse.svelte";
    import {
        chatIdentifiersEqual,
        type ChatSummary,
        OpenChat,
        type ChatIdentifier,
        AvatarSize,
    } from "openchat-client";
    import { activeVideoCall, camera, microphone, sharing } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import type { Theme } from "../../../theme/types";
    import type { DailyThemeConfig } from "@daily-co/daily-js";
    import daily from "@daily-co/daily-js";
    import AreYouSure from "../../AreYouSure.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");

    $: selectedChatId = client.selectedChatId;
    $: chatSummariesStore = client.chatSummariesStore;
    $: communities = client.communities;
    $: userStore = client.userStore;
    $: user = client.user;
    $: chat = normaliseChatSummary($activeVideoCall?.chatId);

    let iframeContainer: HTMLDivElement;
    let confirmSwitchTo: ChatSummary | undefined = undefined;

    $: {
        activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    }

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = $chatSummariesStore.get(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = $userStore[chat.them.userId];
                        return {
                            name: client.displayName(them),
                            avatarUrl: client.userAvatarUrl(them),
                            userId: chat.them,
                        };
                    case "group_chat":
                        return {
                            name: chat.name,
                            avatarUrl: client.groupAvatarUrl(chat),
                            userId: undefined,
                        };
                    case "channel":
                        return {
                            name: `${
                                $communities.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat),
                            userId: undefined,
                        };
                }
            }
        }
    }

    export async function startVideoCall(chat: ChatSummary) {
        try {
            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = chat;
                return;
            }

            activeVideoCall.joining(chat.id);

            // first we need tojoin access jwt from the oc backend
            const { token, roomName } = await client.getVideoChatAccessToken(chat.id);
            const call = daily.createFrame(iframeContainer, {
                token,
                showLeaveButton: true,
                iframeStyle: {
                    width: "100%",
                    height: "100%",
                },
                url: `https://openchat.daily.co/${roomName}`,
                userName: $user.username,
                theme: getThemeConfig($currentTheme),
            });

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

            await call.join();

            activeVideoCall.setCall(chat.id, call);
        } catch (err) {
            toastStore.showFailureToast(i18nKey("videoCall.callFailed"), err);
            activeVideoCall.endCall();
            console.error("Unable to start video call: ", err);
        }
    }

    function getThemeConfig(theme: Theme): DailyThemeConfig {
        return {
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
    }

    function switchCall(confirmed: boolean): Promise<void> {
        if (confirmed && confirmSwitchTo) {
            activeVideoCall.endCall();
            const chat = confirmSwitchTo;
            confirmSwitchTo = undefined;
            return startVideoCall(chat);
        }
        confirmSwitchTo = undefined;
        return Promise.resolve();
    }

    function toggleFullscreen() {
        if ($activeVideoCall) {
            activeVideoCall.fullscreen(!$activeVideoCall.fullscreen);
        }
    }
</script>

{#if confirmSwitchTo}
    <AreYouSure message={i18nKey("videoCall.switchCall")} action={switchCall} />
{/if}

{#if chat !== undefined}
    <div
        id="video-call-container"
        class="video-call-container"
        class:visible={$activeVideoCall &&
            chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId)}>
        <SectionHeader shadow flush>
            <div class="header">
                <div class="avatar">
                    <Avatar
                        url={chat.avatarUrl}
                        showStatus
                        userId={chat.userId?.userId}
                        size={AvatarSize.Default} />
                </div>
                <h2 class="name">{chat.name}</h2>
                <HoverIcon on:click={toggleFullscreen}>
                    {#if $activeVideoCall?.fullscreen}
                        <ArrowCollapse size={$iconSize} color={"var(--icon-txt)"} />
                    {:else}
                        <ArrowExpand size={$iconSize} color={"var(--icon-txt)"} />
                    {/if}
                </HoverIcon>
            </div>
        </SectionHeader>
        <div class="iframe-container" bind:this={iframeContainer}></div>
    </div>
{/if}

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
        width: 100%;

        .name {
            @include font(book, normal, fs-120);
            @include ellipsis();
        }
    }
</style>
