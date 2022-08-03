<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { nnsProposalTopicLabels, NnsProposalTopic } from "../../domain/chat/chat";
    import Toggle from "../Toggle.svelte";
    import { proposalFilters } from "../../stores/proposalFilters";
    import { mobileWidth } from "../../stores/screenDimensions";

    const dispatch = createEventDispatcher();

    const nnsProposalTopics = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    function close() {
        dispatch("close");
    }
</script>

<SectionHeader shadow={true} flush={$mobileWidth}>
    <h4>{$_("proposal.filter")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="proposal-filters">
    {#each nnsProposalTopics as id}
        <div class="topic">
            <Toggle
                id={NnsProposalTopic[id]}
                on:change={() => proposalFilters.toggle(id)}
                label={nnsProposalTopicLabels[id]}
                checked={!$proposalFilters.has(id)}
                bigGap />
        </div>
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
