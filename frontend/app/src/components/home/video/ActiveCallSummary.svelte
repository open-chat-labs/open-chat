<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import {
        routeForChatIdentifier,
        type ChatIdentifier,
        OpenChat,
        AvatarSize,
        chatIdentifiersEqual,
        userStore,
        selectedChatId,
        communities,
        selectedCommunity,
    } from "openchat-client";
    import {
        activeVideoCall,
        microphone,
        camera,
        sharing,
        hasPresence,
    } from "../../../stores/video";
    import page from "page";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import HandFrontLeft from "svelte-material-icons/HandFrontLeft.svelte";
    import MicrophoneOff from "svelte-material-icons/MicrophoneOff.svelte";
    import Video from "svelte-material-icons/Video.svelte";
    import VideoOff from "svelte-material-icons/VideoOff.svelte";
    import MonitorShare from "svelte-material-icons/MonitorShare.svelte";
    import MonitorOff from "svelte-material-icons/MonitorOff.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { publish } from "@src/utils/pubsub";

    const client = getContext<OpenChat>("client");

    $: show =
        $activeVideoCall?.chatId !== undefined &&
        (!chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId) ||
            (chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId) &&
                $activeVideoCall.view === "minimised"));
    $: chat = normaliseChatSummary($activeVideoCall?.chatId);

    function goToCall() {
        if ($activeVideoCall) {
            if (!chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId)) {
                page(routeForChatIdentifier("none", $activeVideoCall.chatId));
            }
            activeVideoCall.setView("default");
        }
    }

    function askToSpeak() {
        publish("askToSpeak");
    }

    function normaliseChatSummary(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = client.lookupChatSummary(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = $userStore.get(chat.them.userId);
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
                            avatarUrl: client.groupAvatarUrl(chat, $selectedCommunity),
                            userId: undefined,
                        };
                }
            }
        }
    }

    function toggleShare() {
        if ($activeVideoCall?.call) {
            if ($sharing) {
                $activeVideoCall.call.stopScreenShare();
            } else {
                $activeVideoCall.call.startScreenShare();
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
        publish("hangup");
    }
</script>

{#if show && $activeVideoCall !== undefined && chat !== undefined}
    <div class="call" tabindex="0" role="button" on:click={goToCall}>
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
                    <TooltipWrapper position={"top"} align={"middle"}>
                        <div
                            slot="target"
                            role="button"
                            tabindex="0"
                            class="cam"
                            on:click|stopPropagation={askToSpeak}>
                            <HandFrontLeft size={"1.6em"} color={"var(--toast-success-txt)"} />
                        </div>
                        <div let:position let:align slot="tooltip">
                            <TooltipPopup {position} {align}>
                                <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
                            </TooltipPopup>
                        </div>
                    </TooltipWrapper>
                {:else}
                    <TooltipWrapper position={"top"} align={"middle"}>
                        <div
                            slot="target"
                            role="button"
                            tabindex="0"
                            class="cam"
                            on:click|stopPropagation={toggleCamera}>
                            {#if $camera}
                                <Video size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <VideoOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        <div let:position let:align slot="tooltip">
                            <TooltipPopup {position} {align}>
                                <Translatable resourceKey={i18nKey("videoCall.toggleCam")} />
                            </TooltipPopup>
                        </div>
                    </TooltipWrapper>
                    <TooltipWrapper position={"top"} align={"middle"}>
                        <div
                            slot="target"
                            role="button"
                            tabindex="0"
                            class="mic"
                            on:click|stopPropagation={toggleMic}>
                            {#if $microphone}
                                <Microphone size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <MicrophoneOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        <div let:position let:align slot="tooltip">
                            <TooltipPopup {position} {align}>
                                <Translatable resourceKey={i18nKey("videoCall.toggleMic")} />
                            </TooltipPopup>
                        </div>
                    </TooltipWrapper>
                    <TooltipWrapper position={"top"} align={"middle"}>
                        <div
                            slot="target"
                            role="button"
                            tabindex="0"
                            class="mic"
                            on:click|stopPropagation={toggleShare}>
                            {#if $sharing}
                                <MonitorOff size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {:else}
                                <MonitorShare size={"1.6em"} color={"var(--toast-success-txt)"} />
                            {/if}
                        </div>
                        <div let:position let:align slot="tooltip">
                            <TooltipPopup {position} {align}>
                                <Translatable resourceKey={i18nKey("videoCall.toggleShare")} />
                            </TooltipPopup>
                        </div>
                    </TooltipWrapper>
                {/if}
                <TooltipWrapper position={"top"} align={"middle"}>
                    <div
                        slot="target"
                        role="button"
                        tabindex="0"
                        class="hangup"
                        on:click|stopPropagation={hangup}>
                        <PhoneHangup size={"1.6em"} color={"var(--toast-success-txt)"} />
                    </div>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable resourceKey={i18nKey("videoCall.leave")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
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
