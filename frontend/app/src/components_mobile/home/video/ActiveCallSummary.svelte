<script lang="ts">
    import { Avatar, ColourVars, Container, IconButton, Subtitle } from "component-lib";
    import {
        allUsersStore,
        chatIdentifiersEqual,
        communitiesStore,
        OpenChat,
        publish,
        routeForChatIdentifier,
        selectedChatIdStore,
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

    function askToSpeak(e?: Event) {
        e?.stopPropagation();
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

    function toggleShare(e?: Event) {
        e?.stopPropagation();
        if ($activeVideoCall?.call) {
            if ($sharing) {
                $activeVideoCall.call.stopScreenShare();
            } else {
                $activeVideoCall.call.startScreenShare();
            }
        }
    }

    function toggleMic(e?: Event) {
        e?.stopPropagation();
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalAudio(!$activeVideoCall.call.localAudio());
        }
    }

    function toggleCamera(e?: Event) {
        e?.stopPropagation();
        if ($activeVideoCall?.call) {
            $activeVideoCall.call.setLocalVideo(!$activeVideoCall.call.localVideo());
        }
    }

    function hangup(e?: Event) {
        e?.stopPropagation();
        publish("hangup");
    }
</script>

{#if show && $activeVideoCall !== undefined && chat !== undefined}
    <Container
        crossAxisAlignment={"center"}
        gap={"lg"}
        padding={"lg"}
        onClick={goToCall}
        background={ColourVars.success}>
        {#if $activeVideoCall.status === "joining"}
            <FancyLoader size={"3rem"} loop />
        {:else}
            <Avatar size={"lg"} url={chat.avatarUrl} />
        {/if}
        <Container direction={"vertical"}>
            <Container gap={"md"}>
                {#if !$hasPresence && $activeVideoCall?.status !== "joining"}
                    <Tooltip position={"top"} align={"middle"}>
                        <IconButton padding={"zero"} onclick={askToSpeak}>
                            {#snippet icon(color)}
                                <HandFrontLeft {color} />
                            {/snippet}
                        </IconButton>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.askToSpeak")} />
                        {/snippet}
                    </Tooltip>
                {:else}
                    <Tooltip position={"top"} align={"middle"}>
                        <IconButton padding={"zero"} onclick={toggleCamera}>
                            {#snippet icon(color)}
                                {#if $camera}
                                    <Video {color} />
                                {:else}
                                    <VideoOff {color} />
                                {/if}
                            {/snippet}
                        </IconButton>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleCam")} />
                        {/snippet}
                    </Tooltip>
                    <Tooltip position={"top"} align={"middle"}>
                        <IconButton padding={"zero"} onclick={toggleMic}>
                            {#snippet icon(color)}
                                {#if $microphone}
                                    <Microphone {color} />
                                {:else}
                                    <MicrophoneOff {color} />
                                {/if}
                            {/snippet}
                        </IconButton>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleMic")} />
                        {/snippet}
                    </Tooltip>
                    <Tooltip position={"top"} align={"middle"}>
                        <IconButton padding={"zero"} onclick={toggleShare}>
                            {#snippet icon(color)}
                                {#if $sharing}
                                    <MonitorOff {color} />
                                {:else}
                                    <MonitorShare {color} />
                                {/if}
                            {/snippet}
                        </IconButton>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("videoCall.toggleShare")} />
                        {/snippet}
                    </Tooltip>
                {/if}
                <Tooltip position={"top"} align={"middle"}>
                    <IconButton padding={"zero"} onclick={hangup}>
                        {#snippet icon(color)}
                            <PhoneHangup {color} />
                        {/snippet}
                    </IconButton>
                    {#snippet popupTemplate()}
                        <Translatable resourceKey={i18nKey("videoCall.leave")} />
                    {/snippet}
                </Tooltip>
            </Container>
            <Subtitle fontWeight={"bold"}>
                {chat.name}
            </Subtitle>
        </Container>
    </Container>
{/if}
