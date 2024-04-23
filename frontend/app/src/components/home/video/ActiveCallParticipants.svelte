<script lang="ts">
    import {
        VideoCallMessageUpdated,
        type MultiUserChatIdentifier,
        type OpenChat,
        type UserSummary,
        chatIdentifiersEqual,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ActiveCallParticipantsHeader from "./ActiveCallParticipantsHeader.svelte";
    import ActiveCallParticipant from "./ActiveCallParticipant.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { popRightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";
    import VirtualList from "../../VirtualList.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    type MappedParticipants = {
        participants: UserSummary[];
        hidden: UserSummary[];
        lastUpdated: bigint;
    };

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let chatId: MultiUserChatIdentifier;
    export let messageId: bigint;
    export let isOwner: boolean;

    $: user = client.user;

    let selectedTab: "presenters" | "viewers" = "presenters";
    let updatesSince = 0n;
    let videoParticipants: MappedParticipants = {
        participants: [],
        hidden: [],
        lastUpdated: 0n,
    };

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        refresh();
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof VideoCallMessageUpdated) {
            if (
                chatIdentifiersEqual(chatId, ev.detail.chatId) &&
                messageId === ev.detail.messageId
            ) {
                refresh();
            }
        }
    }

    function refresh() {
        client.videoCallParticipants(chatId, messageId, updatesSince).then((res) => {
            videoParticipants = res;
            updatesSince = BigInt(Date.now());
        });
    }

    function close() {
        dispatch("close");
        activeVideoCall.participantsOpen(false);
        popRightPanelHistory();
    }

    function selectTab(tab: "presenters" | "viewers") {
        selectedTab = tab;
    }

    function demote(ev: CustomEvent<string>) {
        activeVideoCall.demote(ev.detail);
    }
</script>

<ActiveCallParticipantsHeader on:close={close} />

<div class="tabs">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        tabindex="0"
        role="button"
        on:click={() => selectTab("presenters")}
        class:selected={selectedTab === "presenters"}
        class="tab">
        <Translatable
            resourceKey={i18nKey("videoCall.presenters", {
                count: videoParticipants.participants.length,
            })} />
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        tabindex="0"
        role="button"
        on:click={() => selectTab("viewers")}
        class:selected={selectedTab === "viewers"}
        class="tab">
        <Translatable
            resourceKey={i18nKey("videoCall.viewers", {
                count: videoParticipants.hidden.length,
            })} />
    </div>
</div>

{#if selectedTab === "presenters"}
    {#each videoParticipants.participants as participant}
        <ActiveCallParticipant
            {isOwner}
            on:demote={demote}
            presence={isOwner && participant.userId === $user.userId ? "owner" : "default"}
            {participant} />
    {/each}
{/if}

{#if selectedTab === "viewers"}
    <VirtualList keyFn={(user) => user.userId} items={videoParticipants.hidden} let:item>
        <ActiveCallParticipant {isOwner} presence={"hidden"} participant={item} />
    </VirtualList>
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
</style>
