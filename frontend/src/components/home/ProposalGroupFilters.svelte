<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { NnsProposalTopic } from "../../domain/chat/chat";
    import Toggle from "../Toggle.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { ChatController } from "../../fsm/chat.controller";
    import { proposalTopicsStore } from "../../stores/chat";

    export let controller: ChatController;

    $: filteredProposalsStore = controller.filteredProposals;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
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
    {#each [...$proposalTopicsStore] as [id, label]}
        <Toggle
            id={NnsProposalTopic[id]}
            on:change={() => filteredProposalsStore.toggleFilter(id)}
            {label}
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
