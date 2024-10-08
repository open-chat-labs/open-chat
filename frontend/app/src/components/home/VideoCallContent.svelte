<script lang="ts">
    import { _ } from "svelte-i18n";
    import {
        AvatarSize,
        OpenChat,
        chatIdentifiersEqual,
        type VideoCallContent,
    } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import { activeVideoCall } from "../../stores/video";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let content: VideoCallContent;
    export let messageIndex: number;
    export let timestamp: bigint | undefined;
    export let senderId: string;

    $: selectedChat = client.selectedChatStore;
    $: communityMembers = client.currentCommunityMembers;
    $: userStore = client.userStore;
    $: user = client.user;
    $: displayName = client.getDisplayNameById(senderId, $communityMembers);
    $: incall =
        $activeVideoCall !== undefined &&
        $selectedChat !== undefined &&
        $selectedChat.videoCallInProgress === messageIndex &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChat?.id);
    $: endedDate = content.ended ? new Date(Number(content.ended)) : undefined;
    $: missed =
        content.ended && content.participants.find((p) => p.userId === $user.userId) === undefined;
    $: duration =
        content.ended !== undefined && timestamp !== undefined
            ? i18nKey("videoCall.duration", {
                  duration: client.formatDuration(Number(content.ended - timestamp)),
              })
            : undefined;

    function joinCall() {
        if (!incall && $selectedChat) {
            dispatch("startVideoCall", { chat: $selectedChat, join: true });
        }
    }

    function leaveCall() {
        if (incall) {
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
                url={client.userAvatarUrl($userStore.get(participantId.userId))}
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
        {#if incall}
            <Button fill disabled={content.ended !== undefined} on:click={leaveCall}>
                <Translatable
                    resourceKey={i18nKey(content.ended ? "videoCall.ended" : "videoCall.leave")} />
            </Button>
        {:else}
            <Button fill disabled={endedDate !== undefined} on:click={joinCall}>
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

    :global(.video-call-btn button) {
        &:not(.disabled) {
            border: 1px solid $accent !important;
        }
        min-height: 45px !important;
        min-width: unset !important;

        &:not(.disabled):hover,
        &.loading {
            background-color: $accent;
            color: var(--button-txt);
        }
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
