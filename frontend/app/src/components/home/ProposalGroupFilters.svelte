<script lang="ts">
    import { createEventDispatcher, getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { OpenChat } from "openchat-client";
    import Checkbox from "../Checkbox.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import LinkButton from "../LinkButton.svelte";
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import { proposalActionCategories, ProposalActionCategory } from "stores/proposalSections";

    const OC_PROPOSALS_GROUP = "nsbx4-4iaaa-aaaar-afusa-cai";

    type SectionLabels = Record<ProposalActionCategory, string>;

    const sectionLabels: SectionLabels = {
        all: "",
        unknown: "",
        builtIn: "proposal.builtInAction",
        userIndex: "proposal.userIndexAction",
        groupIndex: "proposal.groupIndexAction",
        notifications: "proposal.notificationsAction",
        proposalsBot: "proposal.proposalsBotAction",
        storageIndex: "proposal.storageIndexAction",
        cyclesDispenser: "proposal.cyclesDispenserAction",
    };

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    $: selectedChatId = client.selectedChatId;
    $: proposalTopicsStore = client.proposalTopicsStore;
    $: filteredProposalsStore = client.filteredProposalsStore;
    $: topics = [...$proposalTopicsStore];
    $: groupTopics = $selectedChatId?.id === OC_PROPOSALS_GROUP;

    $: grouped = [
        ...client.groupBy(topics, ([id, _]) => {
            if (!groupTopics) return "all";

            if (id < 1000) {
                return "builtIn";
            } else if (id < 2000) {
                return "userIndex";
            } else if (id < 3000) {
                return "groupIndex";
            } else if (id < 4000) {
                return "notifications";
            } else if (id < 5000) {
                return "proposalsBot";
            } else if (id < 6000) {
                return "storageIndex";
            } else if (id < 7000) {
                return "cyclesDispenser";
            } else {
                return "unknown";
            }
        }),
    ];

    function close() {
        dispatch("close");
    }

    function kebab(name: string): string {
        return `topic_${name.toLowerCase().split(" ").join("_")}`;
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
    <div class="controls">
        <LinkButton on:click={client.enableAllProposalFilters} underline={"hover"}
            >{$_("proposal.enableAll")}</LinkButton>
        <LinkButton
            on:click={() => client.disableAllProposalFilters(topics.map(([id]) => id))}
            underline={"hover"}>{$_("proposal.disableAll")}</LinkButton>
    </div>
    {#each grouped as [category, topicsInCategory]}
        {#if groupTopics}
            <CollapsibleCard
                on:toggle={() => proposalActionCategories.toggle(category)}
                open={$proposalActionCategories[category]}
                headerText={$_(sectionLabels[category])}>
                {#each topicsInCategory as [id, label]}
                    <div class="toggle">
                        <Checkbox
                            id={kebab(label)}
                            on:change={() => client.toggleProposalFilter(id)}
                            {label}
                            checked={!$filteredProposalsStore?.hasFilter(id)} />
                    </div>
                {/each}
            </CollapsibleCard>
        {:else}
            {#each topicsInCategory as [id, label]}
                <div class="toggle">
                    <Checkbox
                        id={kebab(label)}
                        on:change={() => client.toggleProposalFilter(id)}
                        {label}
                        checked={!$filteredProposalsStore?.hasFilter(id)} />
                </div>
            {/each}
        {/if}
    {/each}
</div>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }

    .toggle {
        margin-bottom: $sp4;
    }

    .proposal-filters {
        background-color: var(--bg);
        padding: $sp4;
        padding-bottom: 0;
        @include nice-scrollbar();

        @include mobile() {
            height: 100%;
        }
    }

    .controls {
        display: flex;
        gap: $sp4;
        align-items: center;
        margin-bottom: $sp4;
    }
</style>
