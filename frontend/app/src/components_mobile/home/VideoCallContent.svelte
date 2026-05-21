<script lang="ts">
    import {
        Avatar,
        Column,
        Body,
        BodySmall,
        Button,
        ChatCaption,
        Row,
        ColourVars,
    } from "component-lib";
    import {
        OpenChat,
        allUsersStore,
        chatIdentifiersEqual,
        currentUserIdStore,
        publish,
        selectedChatSummaryStore,
        type VideoCallContent,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { activeVideoCall } from "../../stores/video";
    import Translatable from "../Translatable.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import PhoneJoin from "svelte-material-icons/PhoneInTalkOutline.svelte";
    import PhoneRemove from "svelte-material-icons/PhoneRemoveOutline.svelte";
    import Clock from "svelte-material-icons/ClockOutline.svelte";
    import Participants from "svelte-material-icons/AccountMultipleOutline.svelte";
    import { now500 } from "@stores/time";

    const client = getContext<OpenChat>("client");
    const DISPLAYED_PARTICIPANTS = 4;

    interface Props {
        content: VideoCallContent;
        messageIndex: number;
        timestamp: bigint | undefined;
        senderId: string;
        me: boolean;
    }

    let { content, messageIndex, timestamp, me }: Props = $props();

    let inCall = $derived(
        $activeVideoCall !== undefined &&
            $selectedChatSummaryStore !== undefined &&
            $selectedChatSummaryStore.videoCallInProgress?.messageIndex === messageIndex &&
            chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatSummaryStore?.id),
    );
    let endedDate = $derived(content.ended ? new Date(Number(content.ended)) : undefined);
    let finished = $derived(endedDate !== undefined);
    let missed = $derived(
        content.ended &&
            content.participants.find((p) => p.userId === $currentUserIdStore) === undefined,
    );

    let duration = $derived.by(() => {
        if (timestamp === undefined) return;

        const elapsed = content.ended
            ? Number(content.ended - timestamp)
            : Number(BigInt($now500) - timestamp);

        return client.formatDuration(elapsed);
    });

    let callTitle = $derived.by(() => {
        if (!finished) {
            if (content.callType === "broadcast") {
                return "videoCall.startedBroadcast";
            }

            return "videoCall.started";
        } else {
            if (missed) {
                return "videoCall.missedCall";
            }

            if (content.callType === "broadcast") {
                return "videoCall.broadcastEnded";
            }

            return "videoCall.ended";
        }
    });

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

<Column gap={"sm"} padding={["zero", "zero", "xl"]} minWidth="60vw">
    <Column
        padding={me ? "xs" : "zero"}
        borderRadius={["lg", "lg", "md", "md"]}
        backgroundColor={ColourVars.background2}>
        <!-- Details -->
        <Column gap="xs">
            <!-- Title -->
            <Column gap="xxs" padding={["xxs", "sm"]}>
                <Row gap="xs" crossAxisAlignment="center">
                    <Video size="1.5rem" />
                    <ChatCaption fontWeight="semi-bold" width="hug">
                        <!-- TODO i18n -->
                        <Translatable resourceKey={i18nKey(callTitle)} />
                    </ChatCaption>
                </Row>
                <Row gap="sm" padding="xxs">
                    <Row width="hug" gap="xs" crossAxisAlignment="center">
                        <Participants size="1rem" color={ColourVars.textSecondary} />
                        <BodySmall colour="textSecondary">
                            {content.participants.length}
                        </BodySmall>
                    </Row>
                    {#if duration !== undefined}
                        <Row width="hug" gap="xs" crossAxisAlignment="center">
                            <Clock size="1rem" color={ColourVars.textSecondary} />
                            <BodySmall colour="textSecondary">
                                {duration}
                            </BodySmall>
                        </Row>
                    {/if}
                </Row>
            </Column>

            <!-- Participants -->
            <Row
                supplementalClass="vc_participants"
                gap="xs"
                padding={["sm", "md"]}
                borderRadius="md"
                crossAxisAlignment="center"
                backgroundColor={ColourVars.background0}>
                {#each [...content.participants].slice(0, DISPLAYED_PARTICIPANTS) as participantId}
                    <Avatar
                        url={client.userAvatarUrl($allUsersStore.get(participantId.userId))}
                        size={"md"} />
                {/each}
                {#if content.participants.length > DISPLAYED_PARTICIPANTS}
                    <div class="extra">
                        <Body align="center">
                            {`+${content.participants.length - DISPLAYED_PARTICIPANTS}`}
                        </Body>
                    </div>
                {/if}
            </Row>

            <!-- Buttons! -->
            {#if inCall}
                <Button disabled={finished} onClick={leaveCall}>
                    {#snippet icon(color)}
                        <PhoneRemove {color} />
                    {/snippet}
                    <Translatable
                        resourceKey={i18nKey(
                            content.ended ? "videoCall.ended" : "videoCall.leave",
                        )} />
                </Button>
            {:else}
                <Button disabled={finished} onClick={joinCall}>
                    {#snippet icon(color)}
                        {#if !finished}
                            <PhoneJoin {color} />
                        {/if}
                    {/snippet}
                    <Column mainAxisAlignment={"center"} crossAxisAlignment={"center"}>
                        <Body width={"hug"} fontWeight={"bold"} colour={"textOnPrimary"}>
                            <Translatable
                                resourceKey={endedDate
                                    ? i18nKey("videoCall.endedAt", {
                                          time: client.toShortTimeString(endedDate),
                                      })
                                    : i18nKey("videoCall.join")} />
                        </Body>
                    </Column>
                </Button>
            {/if}
        </Column>
    </Column>
</Column>

<style lang="scss">
    :global {
        .vc_participants > * {
            border: var(--bw-thick) solid var(--background-0);

            &:not(:first-child) {
                margin-left: -1rem;
            }
        }

        .extra {
            z-index: 1;
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--rad-circle);
            background-color: var(--background-2);
        }
    }
</style>
