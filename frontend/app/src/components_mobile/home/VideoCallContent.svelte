<script lang="ts">
    import { Avatar, Body, BodySmall, Button, ChatText, Container } from "component-lib";
    import {
        OpenChat,
        allUsersStore,
        chatIdentifiersEqual,
        currentUserIdStore,
        publish,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type VideoCallContent,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { activeVideoCall } from "../../stores/video";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: VideoCallContent;
        messageIndex: number;
        timestamp: bigint | undefined;
        senderId: string;
    }

    let { content, messageIndex, timestamp, senderId }: Props = $props();

    let me = $derived(senderId === $currentUserIdStore);
    let displayName = $derived(
        client.getDisplayName(senderId, $selectedCommunityMembersStore, $selectedChatWebhooksStore),
    );
    let inCall = $derived(
        $activeVideoCall !== undefined &&
            $selectedChatSummaryStore !== undefined &&
            $selectedChatSummaryStore.videoCallInProgress?.messageIndex === messageIndex &&
            chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatSummaryStore?.id),
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
        if (!inCall && $selectedChatSummaryStore?.videoCallInProgress) {
            publish("startVideoCall", {
                chatId: $selectedChatSummaryStore.id,
                callType: $selectedChatSummaryStore.videoCallInProgress.callType,
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

<Container gap={"md"} direction={"vertical"}>
    <ChatText>
        {#if content.callType === "broadcast"}
            <Translatable
                resourceKey={i18nKey("videoCall.broadcastStartedBy", { username: displayName })} />
        {:else if missed}
            <Translatable
                resourceKey={i18nKey("videoCall.missedCall", { username: displayName })} />
        {:else}
            <Translatable resourceKey={i18nKey("videoCall.startedBy", { username: displayName })} />
        {/if}
    </ChatText>

    <Container gap={"sm"}>
        {#each [...content.participants].slice(0, 5) as participantId}
            <Avatar
                url={client.userAvatarUrl($allUsersStore.get(participantId.userId))}
                size={"md"} />
        {/each}
        {#if content.participants.length > 5}
            <div class="extra">
                {`+${content.participants.length - 5}`}
            </div>
        {/if}
    </Container>

    <Container>
        {#if inCall}
            <Button disabled={content.ended !== undefined} onClick={leaveCall}>
                <Translatable
                    resourceKey={i18nKey(content.ended ? "videoCall.ended" : "videoCall.leave")} />
            </Button>
        {:else}
            <Button disabled={endedDate !== undefined} onClick={joinCall}>
                <Container
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    direction={"vertical"}>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"} colour={"textOnPrimary"}>
                        <Translatable
                            resourceKey={endedDate
                                ? i18nKey("videoCall.endedAt", {
                                      time: client.toShortTimeString(endedDate),
                                  })
                                : i18nKey("videoCall.join")} />
                    </Body>
                    {#if duration}
                        <BodySmall width={{ kind: "hug" }} colour={"textOnPrimary"}>
                            <Translatable resourceKey={duration} />
                        </BodySmall>
                    {/if}
                </Container>
            </Button>
        {/if}
    </Container>
</Container>
