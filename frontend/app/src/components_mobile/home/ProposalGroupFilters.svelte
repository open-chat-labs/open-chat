<script lang="ts">
    import { CommonButton, Container, Switch } from "component-lib";
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { filteredProposalsStore, proposalTopicsStore } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/CheckCircleOutline.svelte";
    import Minus from "svelte-material-icons/MinusCircleOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import {
        proposalActionCategories,
        type ProposalActionCategory,
    } from "../../stores/proposalSections";
    import { OC_GOVERNANCE_CANISTER_ID } from "../../utils/sns";
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import Translatable from "../Translatable.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";

    interface Props {
        selectedChat: ChatSummary;
    }

    let { selectedChat }: Props = $props();

    type SectionLabels = Record<ProposalActionCategory, string>;

    const sectionLabels: SectionLabels = {
        all: "",
        unknown: "proposal.unknownActionCategory",
        builtIn: "proposal.builtInAction",
        userIndex: "proposal.userIndexAction",
        groupIndex: "proposal.groupIndexAction",
        notifications: "proposal.notificationsAction",
        proposalsBot: "proposal.proposalsBotAction",
        storageIndex: "proposal.storageIndexAction",
        cyclesDispenser: "proposal.cyclesDispenserAction",
        registry: "proposal.registryAction",
        neuronController: "proposal.neuronControllerAction",
        openchatInstaller: "proposal.openchatInstallerAction",
    };

    const client = getContext<OpenChat>("client");
    let topics = $derived([...$proposalTopicsStore]);
    let groupTopics = $derived(
        selectedChat.kind !== "direct_chat" &&
            selectedChat.subtype?.governanceCanisterId === OC_GOVERNANCE_CANISTER_ID,
    );

    let grouped = $derived([
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
            } else if (id < 8000) {
                return "registry";
            } else if (id < 9000) {
                return "neuronController";
            } else if (id < 10000) {
                return "openchatInstaller";
            } else {
                return "unknown";
            }
        }),
    ]);
</script>

<SlidingPageContent title={i18nKey("proposal.filter")}>
    <Container gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container gap={"md"}>
            <CommonButton onClick={() => client.enableAllProposalFilters()}>
                {#snippet icon(color, size)}
                    <Check {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("proposal.enableAll")} />
            </CommonButton>
            <CommonButton
                onClick={() => client.disableAllProposalFilters(topics.map(([id]) => id))}>
                {#snippet icon(color, size)}
                    <Minus {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("proposal.disableAll")} />
            </CommonButton>
        </Container>
        {#each grouped as [category, topicsInCategory]}
            {#if groupTopics}
                <CollapsibleCard
                    onToggle={() => proposalActionCategories.toggle(category)}
                    open={$proposalActionCategories[category]}
                    headerText={i18nKey(sectionLabels[category])}>
                    <Container gap={"lg"} direction={"vertical"}>
                        {#each topicsInCategory as [id, label]}
                            <Switch
                                width={"fill"}
                                reverse
                                onChange={() => client.toggleProposalFilter(id)}
                                checked={!$filteredProposalsStore?.hasFilter(id)}>
                                <Translatable resourceKey={i18nKey(label)}></Translatable>
                            </Switch>
                        {/each}
                    </Container>
                </CollapsibleCard>
            {:else}
                <Container gap={"lg"} direction={"vertical"}>
                    {#each topicsInCategory as [id, label]}
                        <Switch
                            width={"fill"}
                            reverse
                            onChange={() => client.toggleProposalFilter(id)}
                            checked={!$filteredProposalsStore?.hasFilter(id)}>
                            <Translatable resourceKey={i18nKey(label)}></Translatable>
                        </Switch>
                    {/each}
                </Container>
            {/if}
        {/each}
    </Container>
</SlidingPageContent>
