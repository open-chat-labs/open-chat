<script lang="ts">
    import { Column, Sheet, Title } from "component-lib";
    import {
        allUsersStore,
        chatIdentifiersEqual,
        communitiesStore,
        currentUserStore,
        OpenChat,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type ChatIdentifier,
        type VideoCallType,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { videoCameraOn, videoMicOn, videoSpeakerView } from "../../../stores/settings";
    import { toastStore } from "../../../stores/toast";
    import { activeVideoCall } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import {
        CallSession,
        dailyTheme,
        type CallFrameOptions,
        type StartCallOutcome,
    } from "@src/logic/video/callSession.svelte";
    import AreYouSure from "../../AreYouSure.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import ActiveCallHeader from "./ActiveCallHeader.svelte";

    interface Props {
        onClearSelection: () => void;
    }

    let { onClearSelection }: Props = $props();

    const client = getContext<OpenChat>("client");

    let iframeContainer: HTMLDivElement | undefined = $state();
    let chat = $derived(normaliseChatSummary($activeVideoCall?.chatId));
    let threadOpen = $derived($activeVideoCall?.threadOpen ?? false);
    let participantsOpen = $derived($activeVideoCall?.participantsOpen ?? false);

    $effect(() => {
        activeVideoCall.changeTheme(dailyTheme($currentTheme));
    });

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = client.lookupChatSummary(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat": {
                        const them = $allUsersStore.get(chat.them.userId);
                        return {
                            chatId,
                            name: client.displayName(them),
                            avatarUrl: client.userAvatarUrl(them),
                            userId: chat.them,
                            videoCallInProgress: chat.videoCallInProgress,
                        };
                    }
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
                                $communitiesStore.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat, $selectedCommunitySummaryStore),
                            userId: undefined,
                            videoCallInProgress: chat.videoCallInProgress,
                        };
                }
            }
        }
    }

    function frameOptions(chatId: ChatIdentifier): CallFrameOptions {
        return {
            title: normaliseChatSummary(chatId)?.name ?? "",
            username: $currentUserStore.username,
            speakerView: $videoSpeakerView,
            cameraOn: $videoCameraOn,
            micOn: $videoMicOn,
            theme: dailyTheme($currentTheme),
        };
    }

    const session = new CallSession(client, frameOptions, () =>
        toastStore.showSuccessToast(i18nKey("videoCall.noAnswer")),
    );

    function report(outcome: StartCallOutcome | undefined) {
        switch (outcome?.kind) {
            case undefined:
            case "joined":
            case "confirm_switch":
                break;
            case "no_meeting":
                toastStore.showSuccessToast(i18nKey("videoCall.noMeetingToJoin"));
                break;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                break;
            default:
                outcome satisfies never;
        }
    }

    export async function startOrJoinVideoCall(
        chatId: ChatIdentifier,
        callType: VideoCallType,
        join: boolean,
    ) {
        if (iframeContainer === undefined) return;
        report(await session.startOrJoin(iframeContainer, { chatId, callType, join }));
    }

    function switchCall(confirmed: boolean): Promise<void> {
        if (!confirmed) {
            session.cancelSwitch();
        } else if (iframeContainer !== undefined) {
            session.switchCall(iframeContainer).then(report);
        }
        return Promise.resolve();
    }

    export function askToSpeak() {
        session.askToSpeak();
    }

    export function hangup() {
        session.hangup();
    }

    export function closeThread() {
        activeVideoCall.threadOpen(false);
    }
</script>

{#if session.confirmSwitchTo}
    <AreYouSure message={i18nKey("videoCall.switchCall")} action={switchCall} />
{/if}

{#if session.hostEnded}
    <Sheet onDismiss={() => (session.hostEnded = false)}>
        <Column mainAxisAlignment={"center"} crossAxisAlignment={"center"} padding={"xxxl"}>
            <Title width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("videoCall.hostEnded")} />
            </Title>
        </Column>
    </Sheet>
{/if}

{#if session.denied}
    <Sheet onDismiss={() => (session.denied = false)}>
        <Column mainAxisAlignment={"center"} crossAxisAlignment={"center"} padding={"xxxl"}>
            <Title width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("videoCall.denied")} />
            </Title>
        </Column>
    </Sheet>
{/if}

<div
    id="video-call-container"
    class="video-call-container"
    class:visible={$activeVideoCall &&
        $activeVideoCall.view !== "minimised" &&
        !threadOpen &&
        !participantsOpen &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatSummaryStore?.id)}
>
    {#if chat !== undefined}
        <ActiveCallHeader
            {onClearSelection}
            onAskToSpeak={askToSpeak}
            {chat}
            askedToSpeak={session.askedToSpeak}
        />
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
