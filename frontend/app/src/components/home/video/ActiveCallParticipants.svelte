<script lang="ts">
    import type { MultiUserChatIdentifier, OpenChat, UserSummary } from "openchat-client";
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

    onMount(refresh);

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

    function findParticipantId(userId: string): string | undefined {
        if ($activeVideoCall?.call) {
            const participants = $activeVideoCall.call.participants();
            const p = Object.values(participants).find((v) => v.user_id === userId);
            if (p !== undefined) {
                return p.session_id;
            }
        }
    }

    function demote(ev: CustomEvent<string>) {
        if ($activeVideoCall?.call) {
            const participantId = findParticipantId(ev.detail);
            if (participantId) {
                $activeVideoCall.call.updateParticipant(participantId, {
                    updatePermissions: {
                        hasPresence: false,
                        canSend: [],
                    },
                });

                // TODO - we need to also update the presence in OC for this user *before* we refresh
                // TODO - and we probably need to optionally trigger refresh when participant-updated is called
                // not sure how we're going to wire that up though
                refresh();
            }
        }
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
