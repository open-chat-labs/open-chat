<script lang="ts">
    import {
        AvatarSize,
        OpenChat,
        allUsersStore,
        app,
        chatIdentifiersEqual,
        currentUserIdStore,
        publish,
        selectedCommunityMembersStore,
        type VideoCallContent,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { activeVideoCall } from "../../stores/video";
    import Avatar from "../Avatar.svelte";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: VideoCallContent;
        messageIndex: number;
        timestamp: bigint | undefined;
        senderId: string;
    }

    let { content, messageIndex, timestamp, senderId }: Props = $props();

    let displayName = $derived(client.getDisplayNameById(senderId, $selectedCommunityMembersStore));
    let inCall = $derived(
        $activeVideoCall !== undefined &&
            app.selectedChatSummary !== undefined &&
            app.selectedChatSummary.videoCallInProgress?.messageIndex === messageIndex &&
            chatIdentifiersEqual($activeVideoCall.chatId, app.selectedChatSummary?.id),
    );
    let endedDate = $derived(content.ended ? new Date(Number(content.ended)) : undefined);
    let missed = $derived(
        content.ended &&
            content.participants.find((p) => p.userId === $currentUserIdStore) === undefined,
    );
    let duration = $derived(
        content.ended !== undefined && timestamp !== undefined
            ? i18nKey("videoCall.duration", {
                  duration: client.formatDuration(Number(content.ended - timestamp)),
              })
            : undefined,
    );

    function joinCall() {
        if (!inCall && app.selectedChatSummary?.videoCallInProgress) {
            publish("startVideoCall", {
                chatId: app.selectedChatSummary.id,
                callType: app.selectedChatSummary.videoCallInProgress.callType,
                join: true,
            });
        }
    }

    function leaveCall() {
        if (inCall) {
            activeVideoCall.endCall();
        }
    }
</script>

<div class="video-call">
    <p class="initiator" class:missed>
        {#if content.callType === "broadcast"}
            <Translatable
                resourceKey={i18nKey("videoCall.broadcastStartedBy", { username: displayName })} />
        {:else if missed}
            <Translatable
                resourceKey={i18nKey("videoCall.missedCall", { username: displayName })} />
        {:else}
            <Translatable resourceKey={i18nKey("videoCall.startedBy", { username: displayName })} />
        {/if}
    </p>
    <div class="avatars">
        {#each [...content.participants].slice(0, 5) as participantId}
            <Avatar
                url={client.userAvatarUrl($allUsersStore.get(participantId.userId))}
                userId={participantId.userId}
                size={AvatarSize.Small} />
        {/each}
        {#if content.participants.length > 5}
            <div class="extra">
                {`+${content.participants.length - 5}`}
            </div>
        {/if}
    </div>
    <div class="video-call-btn">
        {#if inCall}
            <Button fill disabled={content.ended !== undefined} onClick={leaveCall}>
                <Translatable
                    resourceKey={i18nKey(content.ended ? "videoCall.ended" : "videoCall.leave")} />
            </Button>
        {:else}
            <Button fill disabled={endedDate !== undefined} onClick={joinCall}>
                <Translatable
                    resourceKey={endedDate
                        ? i18nKey("videoCall.endedAt", {
                              time: client.toShortTimeString(endedDate),
                          })
                        : i18nKey("videoCall.join")} />
                {#if duration}
                    <div class="duration">
                        <Translatable resourceKey={duration} />
                    </div>
                {/if}
            </Button>
        {/if}
    </div>
</div>

<style lang="scss">
    $accent: var(--prize);

    .video-call-btn :global(button) {
        min-height: 45px !important;
        min-width: unset !important;
    }

    .video-call-btn :global(button.loading) {
        background-color: $accent;
        color: var(--button-txt);
    }

    .video-call-btn :global(button:not(.disabled):hover) {
        background-color: $accent;
        color: var(--button-txt);
    }

    .video-call-btn :global(button:not(.disabled)) {
        border: 1px solid $accent !important;
    }

    .video-call {
        padding: $sp3 0 0 0;
    }

    .initiator {
        margin-bottom: $sp3;

        &.missed {
            color: var(--warn);
        }
    }

    .avatars {
        display: inline-flex;
        gap: $sp2;
        margin-bottom: $sp4;
    }

    .extra {
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        width: toRem(25);
        height: toRem(25);
        @include font-size(fs-60);
        background-color: rgba(0, 0, 0, 0.15);
    }

    .duration {
        @include font(light, normal, fs-60);
    }
</style>
