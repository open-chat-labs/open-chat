<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { rtlStore } from "../../../stores/rtl";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import WindowMaximize from "svelte-material-icons/WindowMaximize.svelte";
    import WindowMinimize from "svelte-material-icons/WindowMinimize.svelte";
    import {
        chatIdentifiersEqual,
        type ChatSummary,
        OpenChat,
        type ChatIdentifier,
        AvatarSize,
        type AccessTokenType,
        NoMeetingToJoin,
    } from "openchat-client";
    import { activeVideoCall } from "../../../stores/video";
    import AreYouSure from "../../AreYouSure.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
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
    import { iframeApi } from "@huddle01/iframe";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: selectedChat = client.selectedChatStore;
    $: communities = client.communities;
    $: userStore = client.userStore;
    $: chat = normaliseChatSummary($selectedChat, $activeVideoCall?.chatId);
    $: threadOpen = $activeVideoCall?.threadOpen ?? false;

    let confirmSwitchTo: { chat: ChatSummary; join: boolean } | undefined = undefined;
    let meetingUrl: string | undefined = undefined;

    // $: {
    //     activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    // }

    // Note: _selectedChat is passed in as a reactivity hack for svelte :puke:
    function normaliseChatSummary(
        _selectedChat: ChatSummary | undefined,
        chatId: ChatIdentifier | undefined,
    ) {
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
                            // TODO undo this as and when we can support threads in direct chats
                            messageIndex: undefined,
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

    onMount(() => {
        window.addEventListener("message", (ev) => {
            if (ev.origin === "https://openchat.huddle01.com") {
                if (ev?.data?.eventData?.event === "app:initialized") {
                    iframeApi.initialize({
                        background:
                            "https://imageserver.petsbest.com/marketing/blog/puppy-diarrhea.jpg",
                    });
                }
                console.log("Maybe Message from huddle iframe: ", ev);
            }
        });
    });

    export async function startOrJoinVideoCall(chat: ChatSummary, join: boolean) {
        if (chat === undefined) return;

        try {
            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = { chat, join };
                return;
            }

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

            // here is where we need to do something different for huddle
            meetingUrl = `https://openchat.huddle01.com/${roomName}/token?token=${token}`;

            // if we are not joining aka starting we need to tell the other users
            if (!joining) {
                client.ringOtherUsers();
            }

            activeVideoCall.setCall(chat.id, {
                setTheme(_theme: unknown) {},
                destroy() {},
                toggleCamera() {},
                toggleMic() {
                    iframeApi.muteMic();
                },
                toggleShare() {},
            });

            if (joining) {
                await client.joinVideoCall(chat.id, BigInt(messageId));
            }
        } catch (err) {
            if (err instanceof NoMeetingToJoin) {
                toastStore.showSuccessToast(i18nKey("videoCall.noMeetingToJoin"));
            } else {
                toastStore.showFailureToast(i18nKey("videoCall.callFailed"), err);
            }
            activeVideoCall.endCall();
            console.error("Unable to start video call: ", err);
        }
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
        if ($activeVideoCall?.view === "default") {
            activeVideoCall.setView("fullscreen");
        } else if ($activeVideoCall?.view === "fullscreen") {
            activeVideoCall.setView("default");
        }
    }

    function minimise() {
        activeVideoCall.setView("minimised");
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
        $activeVideoCall.view !== "minimised" &&
        !(threadOpen && $mobileWidth) &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChat?.id)}>
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
                    {#if chat.chatId && chat.messageIndex !== undefined}
                        <ActiveCallThreadSummary
                            chatId={chat.chatId}
                            messageIndex={chat.messageIndex} />
                    {/if}
                    <HoverIcon on:click={minimise}>
                        <WindowMinimize size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                    {#if !$mobileWidth}
                        <HoverIcon on:click={toggleFullscreen}>
                            <WindowMaximize size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {/if}
                    <HoverIcon title={$_("videoCall.leave")} on:click={hangup}>
                        <PhoneHangup size={$iconSize} color={"var(--vote-no-color)"} />
                    </HoverIcon>
                </div>
            </div>
        </SectionHeader>
    {/if}
    <iframe
        id="huddle01-iframe"
        src={meetingUrl}
        title="Huddle iframe"
        scrolling="no"
        height="100%"
        width="100%"
        allowFullScreen
        allow="camera; microphone; clipboard-read; clipboard-write; display-capture"></iframe>
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
