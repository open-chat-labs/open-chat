<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import {
        chatIdentifiersEqual,
        type ChatSummary,
        OpenChat,
        type ChatIdentifier,
        type AccessTokenType,
        NoMeetingToJoin,
    } from "openchat-client";
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
    import type { DailyThemeConfig } from "@daily-co/daily-js";
    import daily from "@daily-co/daily-js";
    import AreYouSure from "../../AreYouSure.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import { filterRightPanelHistory } from "../../../stores/rightPanel";
    import { removeQueryStringParam } from "../../../utils/urls";
    import { videoCameraOn, videoMicOn, videoSpeakerView } from "../../../stores/settings";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import ActiveCallHeader from "./ActiveCallHeader.svelte";

    const client = getContext<OpenChat>("client");

    $: selectedChat = client.selectedChatStore;
    $: communities = client.communities;
    $: userStore = client.userStore;
    $: user = client.user;
    $: chat = normaliseChatSummary($selectedChat, $activeVideoCall?.chatId);
    $: threadOpen = $activeVideoCall?.threadOpen ?? false;

    let iframeContainer: HTMLDivElement;
    let confirmSwitchTo: { chat: ChatSummary; join: boolean } | undefined = undefined;
    let hostEnded = false;
    let denied = false;
    let askedToSpeak = false;
    let activeCallHeader: ActiveCallHeader | undefined;

    $: {
        activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    }

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

    export async function startOrJoinVideoCall(chat: ChatSummary, join: boolean) {
        if (chat === undefined) return;

        const isPublic = !client.isChatPrivate(chat);

        try {
            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = { chat, join };
                return;
            }

            // close and threads we have open in the right panel
            filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            removeQueryStringParam("open");

            activeVideoCall.joining(chat.id);

            const callType = isPublic ? "broadcast" : "default";
            const accessType: AccessTokenType = join
                ? { kind: "join_video_call" }
                : { kind: "start_video_call", callType };

            // first we need to get access jwt from the oc backend
            const { token, roomName, messageId, joining } = await client.getVideoChatAccessToken(
                chat.id,
                accessType,
            );

            const call = daily.createFrame(iframeContainer, {
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
                userName: $user.username,
                theme: getThemeConfig($currentTheme),
            });

            call.on("app-message", (ev: InterCallMessage | undefined) => {
                if (ev && ev.action === "app-message" && ev.data.kind === "ask_to_speak") {
                    activeVideoCall.captureAccessRequest(ev.data);
                }
                if (ev && ev.action === "app-message" && ev.data.kind === "ask_to_speak_response") {
                    const me = call.participants().local.session_id;
                    if (ev.data.participantId === me && $user.userId === ev.data.userId) {
                        askedToSpeak = false;
                        denied = !ev.data.approved;
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
                if (ev?.participant.owner && !ev.participant.local && isPublic) {
                    hangup();
                    hostEnded = true;
                }
            });

            call.on("participant-updated", (ev) => {
                if (ev?.participant.local) {
                    microphone.set(ev?.participant.tracks.audio.state !== "off");
                    camera.set(ev?.participant.tracks.video.state !== "off");
                    sharing.set(ev?.participant.tracks.screenVideo.state !== "off");
                    hasPresence.set(ev?.participant.permissions.hasPresence);
                } else {
                    console.log("ParticipantUpdated: ", ev);
                    if (ev?.participant.user_name === $user.username) {
                        // this means that I have joined the call from somewhere else e.g. another device
                        hangup();
                    }
                }
            });

            // if we are not joining aka starting we need to tell the other users
            if (!joining) {
                client.ringOtherUsers();
            }

            await call.join();

            activeVideoCall.setCall(chat.id, call);

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

    export function askToSpeak() {
        activeCallHeader?.askToSpeak();
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

    export function hangup() {
        if ($activeVideoCall?.call) {
            if ($hasPresence) {
                const present = $activeVideoCall.call.participantCounts().present;
                if (present === 1) {
                    // I must be the last person left in the call
                    client.endVideoCall($activeVideoCall.chatId);
                }
            }

            // this will trigger the left-meeting event which will in turn end the call
            $activeVideoCall.call.leave();
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
            <div class="host-ended" slot="body">
                <Translatable resourceKey={i18nKey("videoCall.hostEnded")} />
            </div>
            <span slot="footer">
                <ButtonGroup align={"center"}>
                    <Button on:click={() => (hostEnded = false)}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

{#if denied}
    <Overlay>
        <ModalContent hideHeader>
            <div class="denied" slot="body">
                <Translatable resourceKey={i18nKey("videoCall.denied")} />
            </div>
            <span slot="footer">
                <ButtonGroup align={"center"}>
                    <Button on:click={() => (denied = false)}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<div
    id="video-call-container"
    class="video-call-container"
    class:visible={$activeVideoCall &&
        $activeVideoCall.view !== "minimised" &&
        !(threadOpen && $mobileWidth) &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChat?.id)}>
    {#if chat !== undefined}
        <ActiveCallHeader
            bind:this={activeCallHeader}
            on:clearSelection
            on:hangup={hangup}
            on:showParticipants
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
