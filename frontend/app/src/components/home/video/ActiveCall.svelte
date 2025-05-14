<script lang="ts">
    import type { DailyThemeConfig } from "@daily-co/daily-js";
    import daily, { type DailyCall } from "@daily-co/daily-js";
    import {
        app,
        chatIdentifiersEqual,
        NoMeetingToJoin,
        OpenChat,
        ui,
        userStore,
        type AccessTokenType,
        type ChatIdentifier,
        type VideoCallType,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { videoCameraOn, videoMicOn, videoSpeakerView } from "../../../stores/settings";
    import { toastStore } from "../../../stores/toast";
    import {
        activeVideoCall,
        camera,
        hasPresence,
        microphone,
        sharing,
        type InterCallMessage,
    } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import type { Theme } from "../../../theme/types";
    import { removeQueryStringParam } from "../../../utils/urls";
    import AreYouSure from "../../AreYouSure.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import ActiveCallHeader from "./ActiveCallHeader.svelte";

    interface Props {
        onClearSelection: () => void;
        showLandingPage: boolean;
    }

    let { onClearSelection, showLandingPage }: Props = $props();

    const client = getContext<OpenChat>("client");

    let iframeContainer: HTMLDivElement | undefined = $state();
    let confirmSwitchTo: { chatId: ChatIdentifier; callType: VideoCallType; join: boolean } | undefined = $state(undefined);
    let hostEnded = $state(false);
    let denied = $state(false);
    let askedToSpeak = $state(false);
    let call: DailyCall | undefined = $state();
    let chat = $derived(normaliseChatSummary($activeVideoCall?.chatId));
    let threadOpen = $derived($activeVideoCall?.threadOpen ?? false);
    let participantsOpen = $derived($activeVideoCall?.participantsOpen ?? false);

    $effect(() => {
        activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    });

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = client.lookupChatSummary(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = userStore.get(chat.them.userId);
                        return {
                            chatId,
                            name: client.displayName(them),
                            avatarUrl: client.userAvatarUrl(them),
                            userId: chat.them,
                            videoCallInProgress: chat.videoCallInProgress,
                        };
                    case "group_chat":
                        return {
                            chatId,
                            name: chat.name,
                            avatarUrl: client.groupAvatarUrl(chat),
                            userId: undefined,
                            videoCallInProgress: chat.videoCallInProgress,
                        };
                    case "channel":
                        return {
                            chatId,
                            name: `${
                                app.communities.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat, app.selectedCommunitySummary),
                            userId: undefined,
                            videoCallInProgress: chat.videoCallInProgress,
                        };
                }
            }
        }
    }

    export async function startOrJoinVideoCall(chatId: ChatIdentifier, callType: VideoCallType, join: boolean) {
        if (chat === undefined || iframeContainer === undefined) return;

        try {
            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = { chatId, callType, join };
                return;
            }

            // close and threads we have open in the right panel
            ui.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            removeQueryStringParam("open");

            activeVideoCall.joining(chatId, callType);

            const accessType: AccessTokenType = join
                ? { kind: "join_video_call", chatId }
                : { kind: "start_video_call", callType, chatId };

            // first we need to get access jwt from the oc backend
            const { token, roomName, messageId, joining } = await client.getVideoChatAccessToken(
                chatId,
                accessType,
            );

            if (call !== undefined) {
                await call.destroy();
                call = undefined;
            }

            call = daily.createFrame(iframeContainer, {
                token,
                activeSpeakerMode: callType === "broadcast" ? true : $videoSpeakerView,
                showLeaveButton: false,
                showFullscreenButton: false,
                startVideoOff: !$videoCameraOn,
                startAudioOff: !$videoMicOn,
                iframeStyle: {
                    width: "100%",
                    height: "100%",
                },
                url: `https://openchat.daily.co/${roomName}`,
                userName: app.currentUser.username,
                theme: getThemeConfig($currentTheme),
            });

            call.on("app-message", (ev: InterCallMessage | undefined) => {
                if (chatId.kind === "direct_chat") return;

                if (ev && ev.action === "app-message") {
                    if (ev.data.kind === "ask_to_speak") {
                        activeVideoCall.captureAccessRequest(ev.data);
                    }
                    if (ev.data.kind === "demote_participant") {
                        const me = call?.participants().local.session_id;
                        if (ev.data.participantId === me && app.currentUserId === ev.data.userId) {
                            askedToSpeak = false;
                            client.setVideoCallPresence(chatId, BigInt(messageId), "hidden");
                        }
                    }
                    if (ev.data.kind === "ask_to_speak_response") {
                        const me = call?.participants().local.session_id;
                        if (ev.data.participantId === me && app.currentUserId === ev.data.userId) {
                            askedToSpeak = false;
                            denied = !ev.data.approved;
                            if (ev.data.approved) {
                                client.setVideoCallPresence(chatId, BigInt(messageId), "default");
                            }
                        }
                    }
                }
            });

            // this only fires when *I* leave the meeting
            call.on("left-meeting", () => {
                // at this point I have already left the meeting and so participantCount will always report 0
                // so we can't use it.
                activeVideoCall.endCall();
            });

            // this fires when a remote participant leaves the meeting
            call.on("participant-left", (ev) => {
                // if the owner leaves, end the call
                if (ev?.participant.owner && !ev.participant.local && callType === "broadcast") {
                    hangup();
                    hostEnded = true;
                }
            });

            call.on("joined-meeting", (ev) => {
                const me = ev?.participants?.local;
                if (!me) return;
                if (me.owner) {
                    activeVideoCall.isOwner(true);
                }
            });

            call.on("participant-updated", (ev) => {
                if (ev?.participant.local) {
                    microphone.set(ev?.participant.tracks.audio.state !== "off");
                    camera.set(ev?.participant.tracks.video.state !== "off");
                    sharing.set(ev?.participant.tracks.screenVideo.state !== "off");
                    hasPresence.set(ev?.participant.permissions.hasPresence);
                } else {
                    if (ev?.participant.user_name === app.currentUser.username) {
                        // this means that I have joined the call from somewhere else e.g. another device
                        hangup();
                    }
                }
            });

            // if we are not joining aka starting we need to tell the other users
            if (!joining) {
                client.ringOtherUsers(chatId, messageId);
            }

            await call.join();

            activeVideoCall.setCall(chatId, BigInt(messageId), call);

            if (joining) {
                switch (chatId.kind) {
                    case "direct_chat":
                        await client.joinVideoCall(chatId, BigInt(messageId));
                        break;
                    default:
                        await client.setVideoCallPresence(
                            chatId,
                            BigInt(messageId),
                            callType === "broadcast" ? "hidden" : "default",
                        );
                }
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
            const { chatId, callType, join } = confirmSwitchTo;
            window.setTimeout(() => startOrJoinVideoCall(chatId, callType, join), 100);
        }
        confirmSwitchTo = undefined;
        return Promise.resolve();
    }

    export function askToSpeak() {
        activeVideoCall.askToSpeak(app.currentUserId);
        askedToSpeak = true;
    }

    export function hangup() {
        if ($activeVideoCall?.call) {
            if ($hasPresence) {
                const present = $activeVideoCall.call.participantCounts().present;
                if (present === 1) {
                    // I must be the last person left in the call
                    client.endVideoCall($activeVideoCall.chatId, $activeVideoCall.messageId);
                }
            }

            // this will trigger the left-meeting event which will in turn end the call
            $activeVideoCall.call.leave();
            ui.popRightPanelHistory();
        }
    }

    export function closeThread() {
        activeVideoCall.threadOpen(false);
    }
</script>

{#if confirmSwitchTo}
    <AreYouSure message={i18nKey("videoCall.switchCall")} action={switchCall} />
{/if}

{#if hostEnded}
    <Overlay>
        <ModalContent hideHeader>
            {#snippet body()}
                <div class="host-ended">
                    <Translatable resourceKey={i18nKey("videoCall.hostEnded")} />
                </div>
            {/snippet}
            {#snippet footer()}
                <ButtonGroup align={"center"}>
                    <Button onClick={() => (hostEnded = false)}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

{#if denied}
    <Overlay>
        <ModalContent hideHeader>
            {#snippet body()}
                <div class="denied">
                    <Translatable resourceKey={i18nKey("videoCall.denied")} />
                </div>
            {/snippet}
            {#snippet footer()}
                <span>
                    <ButtonGroup align={"center"}>
                        <Button onClick={() => (denied = false)}>
                            <Translatable resourceKey={i18nKey("close")} />
                        </Button>
                    </ButtonGroup>
                </span>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<div
    id="video-call-container"
    class="video-call-container"
    class:visible={$activeVideoCall &&
        $activeVideoCall.view !== "minimised" &&
        !showLandingPage &&
        !(threadOpen && ui.mobileWidth) &&
        !(participantsOpen && ui.mobileWidth) &&
        chatIdentifiersEqual($activeVideoCall.chatId, app.selectedChatSummary?.id)}>
    {#if chat !== undefined}
        <ActiveCallHeader
            {onClearSelection}
            onHangup={hangup}
            onAskToSpeak={askToSpeak}
            {chat}
            {askedToSpeak} />
    {/if}
    <div class="iframe-container" bind:this={iframeContainer}></div>
</div>

<style lang="scss">
    :global(.video-call-container .section-header) {
        background-color: var(--daily-header);
    }

    .host-ended,
    .denied {
        @include font(bold, normal, fs-130);
        text-align: center;
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
</style>
