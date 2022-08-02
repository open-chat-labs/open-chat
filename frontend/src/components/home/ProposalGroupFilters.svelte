<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { ChatController } from "../../fsm/chat.controller";
    import { NnsProposalTopic } from "../../domain/chat/chat";
    import Toggle from "../Toggle.svelte";

    export let controller: ChatController;

    $: proposalFilters = controller.proposalFilters;

    const dispatch = createEventDispatcher();

    const nnsProposalTopics = [
        { id: 1, label: "Neuron Management" },
        { id: 3, label: "Network Economics" },
        { id: 4, label: "Governance" },
        { id: 5, label: "Node Admin" },
        { id: 6, label: "Participant Management" },
        { id: 7, label: "Subnet Management" },
        { id: 8, label: "Network Canister Management" },
        { id: 9, label: "KYC" },
        { id: 10, label: "Node Provider Rewards" },
        { id: 11, label: "SNS Decentralization Sale" },
    ];

    function close() {
        dispatch("close");
    }
</script>

<SectionHeader flush={true}>
    <h4>{$_("proposal.filter")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="proposal-filters">
    {#each nnsProposalTopics as { id, label }}
        <div class="topic">
            <Toggle
                id={NnsProposalTopic[id]}
                on:change={() => proposalFilters.toggle(id)}
                {label}
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
        margin-top: $sp3;
        color: var(--section-txt);
        background-color: var(--collapsible-bg);
        padding: $sp4;
        padding-bottom: 0;
    }
</style>
