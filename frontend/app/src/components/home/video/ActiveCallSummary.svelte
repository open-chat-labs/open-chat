<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import {
        routeForChatIdentifier,
        type ChatIdentifier,
        OpenChat,
        AvatarSize,
    } from "openchat-client";
    import { activeVideoCall, microphone, camera } from "../../../stores/video";
    import page from "page";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import MicrophoneOff from "svelte-material-icons/MicrophoneOff.svelte";
    import Video from "svelte-material-icons/Video.svelte";
    import VideoOff from "svelte-material-icons/VideoOff.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    $: chatSummariesStore = client.chatSummariesStore;
    $: communities = client.communities;
    $: userStore = client.userStore;

    function goToCall() {
        if ($activeVideoCall) {
            page(routeForChatIdentifier("none", $activeVideoCall.chatId));
        }
    }

    $: chat = normaliseChatSummary($activeVideoCall?.chatId);

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

    function toggleMic() {
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalAudio(!$activeVideoCall.call.localAudio());
        }
    }

    function toggleCamera() {
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalVideo(!$activeVideoCall.call.localVideo());
        }
    }

    function hangup() {
        activeVideoCall.endCall();
    }
</script>

{#if $activeVideoCall !== undefined && chat !== undefined}
    <div class="call">
        {#if $activeVideoCall.status === "joining"}
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
        <div class="details">
            <div class="actions">
                <TooltipWrapper position={"top"} align={"middle"}>
                    <div
                        slot="target"
                        role="button"
                        tabindex="0"
                        class="cam"
                        on:click={toggleCamera}>
                        {#if $camera}
                            <Video size={"1.6em"} color={"var(--txt)"} />
                        {:else}
                            <VideoOff size={"1.6em"} color={"var(--txt)"} />
                        {/if}
                    </div>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable resourceKey={i18nKey("videoCall.toggleCam")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
                <TooltipWrapper position={"top"} align={"middle"}>
                    <div slot="target" role="button" tabindex="0" class="mic" on:click={toggleMic}>
                        {#if $microphone}
                            <Microphone size={"1.6em"} color={"var(--txt)"} />
                        {:else}
                            <MicrophoneOff size={"1.6em"} color={"var(--txt)"} />
                        {/if}
                    </div>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable resourceKey={i18nKey("videoCall.toggleMic")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
                <TooltipWrapper position={"top"} align={"middle"}>
                    <div slot="target" role="button" tabindex="0" class="hangup" on:click={hangup}>
                        <PhoneHangup size={"1.6em"} color={"var(--txt)"} />
                    </div>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable resourceKey={i18nKey("videoCall.disconnect")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
            </div>
            <span role="button" tabindex="0" class="name" on:click={goToCall}>{chat.name}</span>
        </div>
    </div>
{/if}

<style lang="scss">
    .call {
        position: sticky;
        display: flex;
        gap: $sp4;
        align-items: center;
        bottom: 0;
        width: 100%;
        padding: $sp4;
        background-color: var(--toast-success-bg);
        color: var(--toast-success-txt);
    }

    .name {
        cursor: pointer;
    }

    .joining {
        width: toRem(48);
        height: toRem(48);
    }

    .actions {
        cursor: pointer;
        display: flex;
        gap: $sp4;
    }
</style>
