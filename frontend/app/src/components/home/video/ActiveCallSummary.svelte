<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        chatIdentifiersEqual,
        communitiesStore,
        OpenChat,
        publish,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        type ChatIdentifier,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import MicrophoneOff from "svelte-material-icons/MicrophoneOff.svelte";
    import MonitorOff from "svelte-material-icons/MonitorOff.svelte";
    import MonitorShare from "svelte-material-icons/MonitorShare.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import Video from "svelte-material-icons/Video.svelte";
    import VideoOff from "svelte-material-icons/VideoOff.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        activeVideoCall,
        camera,
        hasPresence,
        microphone,
        sharing,
    } from "../../../stores/video";
    import Avatar from "../../Avatar.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let show = $derived(
        $activeVideoCall?.chatId !== undefined &&
            (!chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatIdStore) ||
                (chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatIdStore) &&
                    $activeVideoCall.view === "minimised")),
    );

    let chat = $derived(normaliseChatSummary($activeVideoCall?.chatId));

    function goToCall() {
        if ($activeVideoCall) {
            if (!chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatIdStore)) {
                page(routeForChatIdentifier("none", $activeVideoCall.chatId));
            }
            activeVideoCall.setView("default");
        }
    }

    function askToSpeak(e: Event) {
        e.stopPropagation();
        publish("askToSpeak");
    }

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = client.lookupChatSummary(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = $allUsersStore.get(chat.them.userId);
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
                                $communitiesStore.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat, $selectedCommunitySummaryStore),
                            userId: undefined,
                        };
                }
            }
        }
    }

    function toggleShare(e: Event) {
        e.stopPropagation();
        if ($activeVideoCall?.call) {
            if ($sharing) {
                $activeVideoCall.call.stopScreenShare();
            } else {
                $activeVideoCall.call.startScreenShare();
            }
        }
    }

    function toggleMic(e: Event) {
        e.stopPropagation();
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalAudio(!$activeVideoCall.call.localAudio());
        }
    }

    function toggleCamera(e: Event) {
        e.stopPropagation();
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalVideo(!$activeVideoCall.call.localVideo());
        }
    }

    function hangup(e: Event) {
        e.stopPropagation();
        publish("hangup");
    }
</script>

{#if show && $activeVideoCall !== undefined && chat !== undefined}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="call" tabindex="0" role="button" onclick={goToCall}>
        {#if $activeVideoCall.status === "joining"}
            <div class="joining">
                <FancyLoader loop />
            </div>
        {:else}
            <div class="avatar">
                <Avatar
                    statusBorder={"var(--toast-success-bg)"}
                    url={chat.avatarUrl}
                    showStatus
                    userId={chat.userId?.userId}
                    size={AvatarSize.Default} />
            </div>
        {/if}
        <div class="details">
            <div class="actions">
                {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
                    <Tooltip position={"top"} align={"middle"}>
                        <div role="button" tabindex="0" class="cam" onclick={askToSpeak}>
                            <HandFrontLeft size={"1.6em"} color={"var(--toast-success-txt)"} />
                        </div>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
                        {/snippet}
                    </Tooltip>
                {:else}
                    <Tooltip position={"top"} align={"middle"}>
                        <div role="button" tabindex="0" class="cam" onclick={toggleCamera}>
                            {#if $camera}
                                <Video size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <VideoOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleCam")} />
                        {/snippet}
                    </Tooltip>
                    <Tooltip position={"top"} align={"middle"}>
                        <div role="button" tabindex="0" class="mic" onclick={toggleMic}>
                            {#if $microphone}
                                <Microphone size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <MicrophoneOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleMic")} />
                        {/snippet}
                    </Tooltip>
                    <Tooltip position={"top"} align={"middle"}>
                        <div role="button" tabindex="0" class="mic" onclick={toggleShare}>
                            {#if $sharing}
                                <MonitorOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <MonitorShare size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleShare")} />
                        {/snippet}
                    </Tooltip>
                {/if}
                <Tooltip position={"top"} align={"middle"}>
                    <div role="button" tabindex="0" class="hangup" onclick={hangup}>
                        <PhoneHangup size={"1.6em"} color={"var(--toast-success-txt)"} />
                    </div>
                    {#snippet popupTemplate()}
                        <Translatable resourceKey={i18nKey("videoCall.leave")} />
                    {/snippet}
                </Tooltip>
            </div>
            <span class="name">{chat.name}</span>
        </div>
    </div>
{/if}

<style lang="scss">
    .call {
        cursor: pointer;
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

    .joining {
        width: toRem(48);
        height: toRem(48);
    }

    .actions {
        display: flex;
        gap: $sp4;
    }
</style>
