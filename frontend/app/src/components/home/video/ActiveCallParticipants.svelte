<script lang="ts">
    import {
        type MultiUserChatIdentifier,
        type OpenChat,
        type UserSummary,
        chatIdentifiersEqual,
        currentUser as user,
        type ChatIdentifier,
        subscribe,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ActiveCallParticipantsHeader from "./ActiveCallParticipantsHeader.svelte";
    import ActiveCallParticipant from "./ActiveCallParticipant.svelte";
    import { getContext, onMount } from "svelte";
    import { rightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";
    import VirtualList from "../../VirtualList.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import FancyLoader from "../../icons/FancyLoader.svelte";

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
        onClose: () => void;
    }

    let { chatId, messageId, isOwner, onClose }: Props = $props();

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
        onClose();
        activeVideoCall.participantsOpen(false);
        rightPanelHistory.pop();
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

<ActiveCallParticipantsHeader onClose={close} />

{#if $activeVideoCall !== undefined}
    {#if loading}
        <div class="loader">
            <FancyLoader loop />
        </div>
    {:else}
        {#if $activeVideoCall?.callType === "broadcast"}
            <div class="tabs">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    tabindex="0"
                    role="button"
                    onclick={() => selectTab("presenters")}
                    class:selected={selectedTab === "presenters"}
                    class="tab">
                    <Translatable
                        resourceKey={i18nKey("videoCall.presenters", {
                            count: participants.length,
                        })} />
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    tabindex="0"
                    role="button"
                    onclick={() => selectTab("viewers")}
                    class:selected={selectedTab === "viewers"}
                    class="tab">
                    <Translatable
                        resourceKey={i18nKey("videoCall.viewers", {
                            count: hidden.length,
                        })} />
                </div>
            </div>
        {/if}

        {#if selectedTab === "presenters"}
            {#each participants as participant}
                <ActiveCallParticipant
                    {isOwner}
                    callType={$activeVideoCall.callType}
                    onDemote={demote}
                    presence={isOwner && participant.userId === $user.userId ? "owner" : "default"}
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
    {/if}
{/if}

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
