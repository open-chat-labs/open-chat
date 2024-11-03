<script lang="ts">
    import {
        VideoCallMessageUpdated,
        type MultiUserChatIdentifier,
        type OpenChat,
        type UserSummary,
        chatIdentifiersEqual,
        currentUser as user,
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
    import FancyLoader from "../../icons/FancyLoader.svelte";

    type MappedParticipants = {
        participants: Record<string, UserSummary>;
        hidden: Record<string, UserSummary>;
        lastUpdated: bigint;
    };

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let chatId: MultiUserChatIdentifier;
    export let messageId: bigint;
    export let isOwner: boolean;

    let demoted = new Set<string>();
    let loading = false;

    let selectedTab: "presenters" | "viewers" = "presenters";
    let videoParticipants: MappedParticipants = {
        participants: {},
        hidden: {},
        lastUpdated: 0n,
    };

    $: participants = Object.values(videoParticipants.participants).filter(
        (u) => !demoted.has(u.userId),
    );
    $: hidden = [
        ...Object.values(videoParticipants.hidden),
        ...Object.values(videoParticipants.participants).filter((u) => demoted.has(u.userId)),
    ];

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        refresh(true);
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
        dispatch("close");
        activeVideoCall.participantsOpen(false);
        popRightPanelHistory();
    }

    function selectTab(tab: "presenters" | "viewers") {
        selectedTab = tab;
    }

    function demote(ev: CustomEvent<string>) {
        demoted.add(ev.detail);
        demoted = demoted;
        activeVideoCall.demote(ev.detail);
    }
</script>

<ActiveCallParticipantsHeader on:close={close} />

{#if $activeVideoCall !== undefined}
    {#if loading}
        <div class="loader">
            <FancyLoader loop />
        </div>
    {:else}
        {#if $activeVideoCall?.callType === "broadcast"}
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
                            count: participants.length,
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
                    on:demote={demote}
                    presence={isOwner && participant.userId === $user.userId ? "owner" : "default"}
                    {participant} />
            {/each}
        {/if}

        {#if selectedTab === "viewers"}
            <VirtualList keyFn={(user) => user.userId} items={hidden} let:item>
                <ActiveCallParticipant
                    callType={$activeVideoCall.callType}
                    {isOwner}
                    presence={"hidden"}
                    participant={item} />
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
