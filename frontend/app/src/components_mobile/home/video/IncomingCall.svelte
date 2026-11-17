<script lang="ts">
    import { videoCallChat } from "@src/logic/video/callChat";
    import type { IconComponent } from "@src/utils/iconComponent";
    import { Avatar, Body, ColourVars, Column, Row, Sheet, Subtitle } from "component-lib";
    import {
        allUsersStore,
        communitiesStore,
        type ChatIdentifier,
        type OpenChat,
        type VideoCallType,
    } from "@client";
    import { getContext } from "svelte";
    import Phone from "svelte-material-icons/Phone.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        activeVideoCall,
        incomingVideoCall,
        ringtoneUrls,
        selectedRingtone,
        type IncomingVideoCall,
        type RingtoneKey,
    } from "../../../stores/video";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        onJoinVideoCall: (chatId: ChatIdentifier, callType: VideoCallType) => void;
    }

    let { onJoinVideoCall }: Props = $props();

    const client = getContext<OpenChat>("client");

    const chat = $derived(normaliseChatSummary($incomingVideoCall));
    const ringtoneUrl = $derived(ringtoneUrls[$selectedRingtone as RingtoneKey]);
    const isOnAnotherCall = $derived($activeVideoCall !== undefined);

    function normaliseChatSummary(call: IncomingVideoCall | undefined) {
        if (call === undefined) return undefined;
        const chat = client.lookupChatSummary(call.chatId);
        const initiator = $allUsersStore.get(call.userId);
        if (chat === undefined || initiator === undefined) return undefined;
        const { chatId, name, avatarUrl } = videoCallChat(
            client,
            chat,
            $allUsersStore,
            $communitiesStore,
        );
        return { chatId, name, avatarUrl, initiator: initiator.username };
    }

    function join() {
        if ($incomingVideoCall !== undefined) {
            onJoinVideoCall($incomingVideoCall.chatId, $incomingVideoCall.callType);
        }
    }

    // The ring UI goes but the call keeps ringing elsewhere. Also fires when the sheet or
    // overlay unmounts, so it must never decline.
    function cancel() {
        incomingVideoCall.set(undefined);
    }

    // The hangup button: a direct call ends for the caller too
    function decline() {
        const call = $incomingVideoCall;
        incomingVideoCall.set(undefined);
        if (call !== undefined) {
            client.declineVideoCall(call.chatId);
        }
    }
</script>

{#if chat !== undefined}
    {#if !isOnAnotherCall}
        <audio playsinline={true} autoplay={true} src={ringtoneUrl} muted={false} preload="auto">
        </audio>
    {/if}
    <Sheet onDismiss={cancel}>
        <Column gap={"xxl"} padding={"xxxl"}>
            <Row gap={"lg"}>
                <Avatar url={chat.avatarUrl} size={"lg"} />
                <Column>
                    <Subtitle fontWeight={"bold"}>{chat.name}</Subtitle>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                $incomingVideoCall?.callType === "audio"
                                    ? "videoCall.audioRemoteStart"
                                    : "videoCall.remoteStart",
                                { name: chat.initiator },
                            )} />
                    </Body>
                </Column>
            </Row>
            <Row
                padding={["zero", "xl"]}
                gap={"lg"}
                crossAxisAlignment={"center"}
                mainAxisAlignment={"spaceAround"}>
                {@render button(PhoneHangup, ColourVars.validationError, decline)}
                {@render button(Phone, ColourVars.validationSuccess, join)}
            </Row>
        </Column>
    </Sheet>
{/if}

{#snippet button(Icon: IconComponent, colour: string, onClick: () => void)}
    <Column
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        borderRadius={"circle"}
        {onClick}
        backgroundColor={colour}
        width={{ size: "5rem" }}
        height={{ size: "5rem" }}>
        <Icon size={"2.5rem"} color={ColourVars.textPrimary} />
    </Column>
{/snippet}
