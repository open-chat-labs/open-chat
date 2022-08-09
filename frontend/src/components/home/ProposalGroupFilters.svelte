<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { nnsProposalTopicLabels, NnsProposalTopic, ChatSummary } from "../../domain/chat/chat";
    import Toggle from "../Toggle.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { SnsFunctions, snsFunctions } from "../../stores/snsFunctions";
    import type { ChatController } from "../../fsm/chat.controller";

    const nnsProposalTopics = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    export let controller: ChatController;

    $: chat = controller.chat;
    $: filteredProposalsStore = controller.filteredProposals;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function getTopics(chat: ChatSummary, snsFunctions: SnsFunctions): number[] {
        if (chat.kind === "group_chat" && chat.subtype !== undefined) {
            if (chat.subtype.isNns) {
                return nnsProposalTopics;
            } else {
                const snsFunctionsMap = snsFunctions.get(chat.subtype.governanceCanisterId);
                if (snsFunctionsMap !== undefined) {
                    return [...snsFunctionsMap.keys()].slice(1);
                }
            }
        }

        return [];
    }

    function getTopicLabel(topicId: number, chat: ChatSummary, snsFunctions: SnsFunctions): string {
        if (chat.kind === "group_chat" && chat.subtype !== undefined) {
            if (chat.subtype.isNns) {
                return nnsProposalTopicLabels[topicId];
            } else {
                const snsFunctionsMap = snsFunctions.get(chat.subtype.governanceCanisterId);
                if (snsFunctionsMap !== undefined) {
                    const snsFunction = snsFunctionsMap.get(topicId);
                    if (snsFunction !== undefined) {
                        return snsFunction.name;
                    }
                }
            }
        }

        return topicId.toString();
    }
</script>

<SectionHeader shadow flush={$mobileWidth}>
    <h4>{$_("proposal.filter")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="proposal-filters">
    {#each getTopics($chat, $snsFunctions) as id}
        <Toggle
            id={NnsProposalTopic[id]}
            on:change={() => filteredProposalsStore.toggleFilter(id)}
            label={getTopicLabel(id, $chat, $snsFunctions)}
            checked={!$filteredProposalsStore?.hasFilter(id)}
            bigGap />
    {/each}
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
    .proposal-filters {
        color: var(--section-txt);
        background-color: var(--collapsible-bg);
        padding: $sp4;
        padding-bottom: 0;

        @include mobile() {
            height: 100%;
        }
    }
</style>
