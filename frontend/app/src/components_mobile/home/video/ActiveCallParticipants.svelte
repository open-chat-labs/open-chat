<script lang="ts">
    import { Chip, Container } from "component-lib";
    import {
        type ChatIdentifier,
        type MultiUserChatIdentifier,
        type OpenChat,
        type UserSummary,
        chatIdentifiersEqual,
        currentUserIdStore,
        publish,
        subscribe,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { activeVideoCall } from "../../../stores/video";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import ActiveCallParticipant from "./ActiveCallParticipant.svelte";

    type MappedParticipants = {
        participants: Record<string, UserSummary>;
        hidden: Record<string, UserSummary>;
        lastUpdated: bigint;
    };

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: MultiUserChatIdentifier;
        messageId: bigint;
        isOwner: boolean;
    }

    let { chatId, messageId, isOwner }: Props = $props();

    let demoted = $state(new Set<string>());
    let loading = $state(false);

    let selectedTab: "presenters" | "viewers" = $state("presenters");
    let videoParticipants: MappedParticipants = $state({
        participants: {},
        hidden: {},
        lastUpdated: 0n,
    });

    let participants = $derived(
        Object.values(videoParticipants.participants).filter((u) => !demoted.has(u.userId)),
    );
    let hidden = $derived([
        ...Object.values(videoParticipants.hidden),
        ...Object.values(videoParticipants.participants).filter((u) => demoted.has(u.userId)),
    ]);

    onMount(() => {
        const unsub = subscribe("videoCallMessageUpdated", videoCallMessageUpdated);
        refresh(true);
        return unsub;
    });

    function videoCallMessageUpdated(payload: { chatId: ChatIdentifier; messageId: bigint }) {
        if (chatIdentifiersEqual(chatId, payload.chatId) && messageId === payload.messageId) {
            refresh();
        }
    }

    function refresh(initialising: boolean = false) {
        loading = initialising;
        client
            .videoCallParticipants(chatId, messageId, 0n)
            .then((res) => {
                videoParticipants = res;
                Object.values(videoParticipants.hidden).forEach((h) => demoted.delete(h.userId));
                demoted = demoted;
            })
            .finally(() => (loading = false));
    }

    function close() {
        publish("closeModalPage");
        activeVideoCall.participantsOpen(false);
        client.popRightPanelHistory();
    }

    function selectTab(tab: "presenters" | "viewers") {
        selectedTab = tab;
    }

    function demote(userId: string) {
        demoted.add(userId);
        demoted = demoted;
        activeVideoCall.demote(userId);
    }
</script>

<SlidingPageContent onBack={close} title={i18nKey("videoCall.participants")}>
    <Container height={{ kind: "fill" }} gap={"lg"} direction={"vertical"} padding={"lg"}>
        {#if $activeVideoCall !== undefined}
            {#if loading}
                <Container
                    height={{ kind: "fill" }}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}>
                    <FancyLoader size={"5rem"} loop />
                </Container>
            {:else}
                {#if $activeVideoCall?.callType === "broadcast"}
                    <Container gap={"sm"}>
                        <Chip
                            mode={selectedTab === "presenters" ? "rounded" : "unselected"}
                            onClick={() => selectTab("presenters")}>
                            <Translatable
                                resourceKey={i18nKey("videoCall.presenters", {
                                    count: participants.length,
                                })} />
                        </Chip>
                        <Chip
                            mode={selectedTab === "viewers" ? "rounded" : "unselected"}
                            onClick={() => selectTab("viewers")}>
                            <Translatable
                                resourceKey={i18nKey("videoCall.viewers", {
                                    count: hidden.length,
                                })} />
                        </Chip>
                    </Container>
                {/if}

                <Container direction={"vertical"} height={{ kind: "fill" }}>
                    {#if selectedTab === "presenters"}
                        {#each participants as participant}
                            <ActiveCallParticipant
                                {isOwner}
                                callType={$activeVideoCall.callType}
                                onDemote={demote}
                                presence={isOwner && participant.userId === $currentUserIdStore
                                    ? "owner"
                                    : "default"}
                                {participant} />
                        {/each}
                    {/if}

                    {#if selectedTab === "viewers"}
                        <VirtualList keyFn={(user) => user.userId} items={hidden}>
                            {#snippet children(item)}
                                <ActiveCallParticipant
                                    callType={$activeVideoCall.callType}
                                    {isOwner}
                                    presence={"hidden"}
                                    participant={item} />
                            {/snippet}
                        </VirtualList>
                    {/if}
                </Container>
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

<style lang="scss">
    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin: 0 $sp4 $sp5 $sp4;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }
    .loader {
        width: 80px;
        margin: auto auto;
    }
</style>
