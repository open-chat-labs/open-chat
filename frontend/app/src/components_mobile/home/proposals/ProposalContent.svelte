<script lang="ts">
    import {
        Body,
        BodySmall,
        ChatLabel,
        Caption,
        ChatText,
        ColourVars,
        Column,
        CommonButton2,
        Row,
        Sheet,
        Subtitle,
        Title,
    } from "component-lib";
    import {
        type ChatIdentifier,
        type OpenChat,
        type ProposalContent,
        ProposalDecisionStatus,
        type RegisterProposalVoteResponse,
        currentUserIdStore,
        proposalTopicsStore,
    } from "openchat-client";
    import { ErrorCode, type ReadonlyMap } from "openchat-shared";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Alert from "svelte-material-icons/ShieldAlert.svelte";
    import InfoSlabBoxOut from "svelte-material-icons/InformationOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultipleOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { NamedNeurons } from "../../../stores/namedNeurons";
    import { proposalVotes } from "../../../stores/proposalVotes";
    import { now } from "../../../stores/time";
    import { toastStore } from "../../../stores/toast";
    import { round2 } from "../../../utils/math";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "@shared_components/Markdown.svelte";
    import ProposalVoteButton from "./ProposalVoteButton.svelte";
    import ProposalVotingProgress from "./ProposalVotingProgress.svelte";
    import ProposalStatusLabel from "./ProposalStatusLabel.svelte";

    interface Props {
        content: ProposalContent;
        chatId: ChatIdentifier;
        messageIndex: number;
        messageId: bigint;
        collapsed: boolean;
        readonly: boolean;
        reply: boolean;
        onExpandMessage?: () => void;
    }

    let {
        content,
        chatId,
        messageIndex,
        messageId,
        collapsed,
        readonly,
        reply,
        onExpandMessage,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const EMPTY_MOTION_PAYLOAD = "# Motion Proposal:\n## Motion Text:\n\n";

    const dashboardUrl = "https://dashboard.internetcomputer.org";
    let showNeuronInfo = $state(false);
    let rootCanister = $derived(
        client.tryGetNervousSystem(content.governanceCanisterId)?.rootCanisterId ?? "",
    );
    let isNns = $derived(content.proposal.kind === "nns");
    let voteStatus = $derived(
        $proposalVotes.get(messageId) ??
            (content.myVote !== undefined ? (content.myVote ? "adopted" : "rejected") : undefined),
    );
    let proposal = $derived(content.proposal);
    let statusColour: Record<ProposalDecisionStatus, string> = {
        0: ColourVars.disabledButton, // unspecified
        1: ColourVars.error, // failed
        2: ColourVars.warning, // open
        3: ColourVars.error, // rejected
        4: ColourVars.success, // executed
        5: ColourVars.success, // adopted
    };
    let proposalUrl = $derived(
        isNns
            ? `${dashboardUrl}/proposal/${proposal.id}`
            : `${dashboardUrl}/sns/${rootCanister}/proposal/${proposal.id}`,
    );
    let proposerUrl = $derived(
        isNns
            ? `${dashboardUrl}/neuron/${proposal.proposer}`
            : `${dashboardUrl}/sns/${rootCanister}/neuron/${proposal.proposer}`,
    );
    let adoptPercent = $derived(round2((100 * proposal.tally.yes) / proposal.tally.total));
    let rejectPercent = $derived(round2((100 * proposal.tally.no) / proposal.tally.total));
    let votingEnded = $derived(proposal.deadline <= $now);
    let disable = $derived(readonly || reply || votingEnded);
    let votingDisabled = $derived(voteStatus !== undefined || disable);
    let typeValue = $derived(getProposalTopicLabel(content, $proposalTopicsStore));
    let payload = $derived(content.proposal.payloadTextRendering);
    let payloadEmpty = $derived(
        payload === undefined || payload === EMPTY_MOTION_PAYLOAD || payload.length === 0,
    );

    // Certain SNS proposal actions are considered "critical" and use higher
    // voting thresholds. Keep this list in sync with the SNS governance
    // specification / action-id mapping used by the client. (If the upstream
    // action ids change, this classification must be updated accordingly.)
    const criticalSnsProposals = [
        9, // transfer treasury funds
        11, // deregister dapp canisters
        12, // mint sns tokens
    ];
    let isCritical = $derived(
        content.proposal.kind === "sns"
            ? criticalSnsProposals.indexOf(content.proposal.action) > -1
            : false,
    );

    let showDetails = $state(false);

    function onVote(adopt: boolean) {
        if (votingDisabled || (chatId.kind !== "group_chat" && chatId.kind !== "channel")) {
            return;
        }

        const mId = messageId;
        proposalVotes.insert(mId, adopt ? "adopting" : "rejecting");

        let success = false;
        client
            .registerProposalVote(chatId, messageIndex, adopt)
            .then((resp) => {
                if (resp.kind === "success") {
                    success = true;
                    proposalVotes.insert(mId, adopt ? "adopted" : "rejected");
                    client.getProposalVoteDetails(
                        messageId,
                        content.governanceCanisterId,
                        proposal.id,
                        isNns,
                    );
                } else if (resp.kind === "error" && resp.code === ErrorCode.NoEligibleNeurons) {
                    showNeuronInfo = true;
                } else {
                    const err = registerProposalVoteErrorMessage(resp);
                    if (err) toastStore.showFailureToast(i18nKey("proposal." + err));
                }
            })
            .catch((err) => {
                client.logError("Unable to vote on proposal", err);
                toastStore.showFailureToast(i18nKey("proposal.voteFailed"));
            })
            .finally(() => {
                if (!success) {
                    proposalVotes.delete(mId);
                }
            });
    }

    function registerProposalVoteErrorMessage(
        resp: RegisterProposalVoteResponse,
    ): string | undefined {
        if (resp.kind === "error" && resp.code === ErrorCode.NoChange) return "alreadyVoted";
        if (resp.kind === "error" && resp.code === ErrorCode.ProposalNotAcceptingVotes)
            return "proposalNotAcceptingVotes";
        return "voteFailed";
    }

    function expand() {
        if (collapsed) {
            onExpandMessage?.();
        }
    }

    function renderNeuronId(neuronId: string): string {
        const name = NamedNeurons[neuronId];
        if (name !== undefined) {
            return name;
        }

        const length = neuronId.length;
        if (length < 12) {
            return neuronId;
        }

        return `${neuronId.slice(0, 4)}..${neuronId.slice(length - 4, length)}`;
    }

    export function getProposalTopicLabel(
        content: ProposalContent,
        proposalTopics: ReadonlyMap<number, string>,
    ): string {
        return (
            proposalTopics.get(
                content.proposal.kind === "nns" ? content.proposal.topic : content.proposal.action,
            ) ?? "unknown"
        );
    }
</script>

{#snippet header()}
    <Column gap={"md"} width="fill">
        <!-- Title -->
        <Column>
            <Title fontWeight="semi-bold" width="fill">
                {#if proposal.url.length > 0}
                    <a class="title_link" href={proposal.url} rel="noreferrer" target="_blank">
                        {proposal.title}
                        <BodySmall colour="textSecondary" fontWeight="semi-bold"
                            >[<Translatable resourceKey={i18nKey("proposal.link")} />]</BodySmall>
                    </a>
                {:else}
                    {proposal.title}
                {/if}
            </Title>
        </Column>

        <!-- Status & Details -->
        <Row crossAxisAlignment="center" gap="xs">
            <ProposalStatusLabel
                content={{ kind: "value", value: ProposalDecisionStatus[proposal.status] }}
                bgColor={statusColour[proposal.status]} />
        </Row>
    </Column>
{/snippet}

{#snippet metadata()}
    <Column gap="sm" width="fill">
        <!-- Proposal type -->
        <Row gap="sm">
            {#if isCritical}
                <Alert color={ColourVars.error} size="1.25rem" />
            {:else}
                <InfoSlabBoxOut color={ColourVars.textPrimary} size="1.25rem" />
            {/if}
            <Column>
                <ChatText width="hug" fontWeight="semi-bold" colour="textPrimary">
                    {typeValue}
                </ChatText>
                {#if isCritical}
                    <BodySmall colour="error">
                        <Translatable resourceKey={i18nKey("proposal.criticalProposal")} />
                    </BodySmall>
                {/if}
            </Column>
        </Row>

        <!-- Who proposed the proposal -->
        <Row gap="sm">
            <AccountMultiple color={ColourVars.textSecondary} size="1.25rem" />
            <Row gap="xs">
                <ChatText width="fill" colour="textSecondary">
                    <Translatable resourceKey={i18nKey("proposal.proposedBy")} />
                    <a class="sender_link" target="_blank" rel="noreferrer" href={proposerUrl}>
                        {renderNeuronId(proposal.proposer)}
                    </a>
                </ChatText>
            </Row>
        </Row>
    </Column>
{/snippet}

{#snippet progress()}
    <ProposalVotingProgress
        deadline={proposal.deadline}
        {votingEnded}
        {adoptPercent}
        {rejectPercent}
        minYesPercentageOfTotal={proposal.minYesPercentageOfTotal}
        minYesPercentageOfExercised={proposal.minYesPercentageOfExercised} />
{/snippet}

{#if collapsed}
    <Column onClick={expand}>
        <Row
            gap="sm"
            padding="md"
            borderRadius={["lg", "lg", "md", "md"]}
            crossAxisAlignment="center"
            backgroundColor={ColourVars.background1}>
            <Subtitle fontWeight="semi-bold" colour="primary">
                {proposal.title}
            </Subtitle>
            <ChevronRight size="1.25rem" color={ColourVars.primary} />
        </Row>
        <Row gap="xs" padding="sm" crossAxisAlignment="center">
            <ChatLabel width="hug" colour="textSecondary">
                <Translatable resourceKey={i18nKey("proposal.tapToExpand")} />
            </ChatLabel>
        </Row>
    </Column>
{:else}
    <Column
        gap="lg"
        padding={["md", "md"]}
        width={{ size: "72vw" }}
        borderRadius={["lg", "lg", "md", "md"]}
        backgroundColor={ColourVars.background0}>
        {@render header()}
        {@render metadata()}
        <div class="separator"></div>
        {@render progress()}
        <div class="separator"></div>
        <Row mainAxisAlignment="center">
            <CommonButton2 onClick={() => (showDetails = true)} variant="primary" mode="text">
                <Translatable resourceKey={i18nKey("proposal.viewDetails")} />
            </CommonButton2>
        </Row>
    </Column>
    <Row gap="sm" padding={["sm", "xxs", "xl"]}>
        <ProposalVoteButton
            mode="yes"
            voting={voteStatus === "adopting"}
            voted={voteStatus === "adopted"}
            disabled={votingDisabled}
            onClick={() => onVote(true)}
            percentage={adoptPercent} />
        <ProposalVoteButton
            mode="no"
            voting={voteStatus === "rejecting"}
            voted={voteStatus === "rejected"}
            disabled={votingDisabled}
            onClick={() => onVote(false)}
            percentage={rejectPercent} />
    </Row>
{/if}

<!-- Proposal details -->

{#if showDetails}
    <Sheet onDismiss={() => (showDetails = false)}>
        <Column gap="lg" maxHeight="70vh" overflow="auto" padding={["md", "xl", "huge"]}>
            <Column gap="md">
                <!-- Header labels -->
                <Row gap="sm" crossAxisAlignment="end" mainAxisAlignment="start">
                    <ProposalStatusLabel
                        content={{ kind: "value", value: ProposalDecisionStatus[proposal.status] }}
                        bgColor={statusColour[proposal.status]} />

                    {#if isCritical}
                        <Row
                            width="hug"
                            borderColour={ColourVars.error}
                            borderWidth="thick"
                            borderRadius="md"
                            padding={["xs", "sm"]}>
                            <Body colour="error">
                                <Translatable resourceKey={i18nKey("proposal.criticalProposal")} />
                            </Body>
                        </Row>
                    {/if}
                </Row>

                <!-- Title -->
                <Title fontWeight="semi-bold" width="fill">
                    {#if proposal.url.length > 0}
                        <a
                            class="title_link"
                            href={proposal.url}
                            rel="noreferrer"
                            target="_blank"
                            style:color={ColourVars.textPrimary}>
                            {proposal.title}
                            <BodySmall colour="primary" fontWeight="semi-bold"
                                >[<Translatable
                                    resourceKey={i18nKey("proposal.link")} />]</BodySmall>
                        </a>
                    {:else}
                        {proposal.title}
                    {/if}
                </Title>

                <Row wrap gap="sm" crossAxisAlignment="center">
                    <!-- ID link -->
                    <a href={proposalUrl} rel="noreferrer" target="_blank">
                        <Row gap="xs" width="hug" crossAxisAlignment="center">
                            <BodySmall fontWeight="semi-bold" colour="primary">
                                ID {proposal.id}
                            </BodySmall>
                        </Row>
                    </a>
                    <Caption colour="textSecondary" width={"hug"}>|</Caption>

                    <!-- Type of proposal -->
                    <BodySmall width="hug" fontWeight="semi-bold" colour="textPrimary">
                        {typeValue}
                    </BodySmall>
                </Row>

                <!-- Proposal origin -->
                <Row wrap gap="xs" crossAxisAlignment="center">
                    <BodySmall width="hug" colour="textSecondary">
                        <Translatable resourceKey={i18nKey("proposal.proposedBy")} />
                    </BodySmall>
                    <BodySmall fontWeight="semi-bold" colour="primary">
                        <a
                            target="_blank"
                            rel="noreferrer"
                            href={proposerUrl}
                            style:color={ColourVars.primary}>
                            {renderNeuronId(proposal.proposer)}
                        </a>
                    </BodySmall>
                </Row>
            </Column>

            <!-- Summary -->
            <Body fontWeight="light" colour="textPrimary">
                <Markdown text={proposal.summary} inline={false} />
            </Body>

            <!-- Additional details -->
            {#if !payloadEmpty}
                <Row padding={["sm", "zero"]}>
                    <div class="separator thick"></div>
                </Row>
                <Column gap="lg">
                    <Subtitle fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("proposal.details")} />
                    </Subtitle>
                    <Body colour="textSecondary">
                        <Markdown text={payload ?? ""} inline={false} />
                    </Body>
                </Column>
            {/if}

            <!-- Passing a proposal -->
            <Row padding={["sm", "zero"]}>
                <div class="separator thick"></div>
            </Row>
            <Column gap="lg">
                <Body fontWeight="semi-bold" colour="textPrimary">
                    <Translatable
                        resourceKey={i18nKey(
                            `proposal.passing.title.${isCritical ? "critical" : "regular"}`,
                        )} />
                </Body>
                <Row gap="lg">
                    <Row width={{ size: "0.75rem" }}>
                        <Body width="hug" colour="textSecondary">1.</Body>
                    </Row>
                    <Column gap="sm">
                        <Body colour="textPrimary">
                            <Translatable
                                resourceKey={i18nKey("proposal.passing.participation.fst", {
                                    pct: `${proposal.minYesPercentageOfTotal}%`,
                                })} />
                        </Body>
                        <Body colour="textSecondary">
                            <Translatable
                                resourceKey={i18nKey("proposal.passing.participation.snd")} />
                        </Body>
                    </Column>
                </Row>
                <Row gap="lg">
                    <Row width={{ size: "0.75rem" }}>
                        <Body width="hug" colour="textSecondary">2.</Body>
                    </Row>
                    <Column gap="sm">
                        <Body colour="textPrimary">
                            <Translatable
                                resourceKey={i18nKey(
                                    `proposal.passing.majority.${isCritical ? "critical" : "regular"}.fst`,
                                    {
                                        pct: `${proposal.minYesPercentageOfExercised}%`,
                                    },
                                )} />
                        </Body>
                        <Body colour="textSecondary">
                            <Translatable
                                resourceKey={i18nKey(
                                    `proposal.passing.majority.${isCritical ? "critical" : "regular"}.snd`,
                                )} />
                        </Body>
                        <Body colour="textSecondary">
                            <Translatable resourceKey={i18nKey(`proposal.passing.majority.thrd`)} />
                        </Body>
                    </Column>
                </Row>
            </Column>
        </Column>
    </Sheet>
{/if}

{#if showNeuronInfo}
    <Sheet onDismiss={() => (showNeuronInfo = false)}>
        <Column gap="xl" padding={["md", "xl", "huge"]}>
            <Title fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("proposal.noEligibleNeurons")} />
            </Title>
            <Body colour="textSecondary">
                {@html $_("proposal.noEligibleNeuronsMessage", {
                    values: { userId: $currentUserIdStore },
                })}
            </Body>
        </Column>
    </Sheet>
{/if}

<style lang="scss">
    .title_link {
        width: 100%;
    }
    .sender_link {
        color: var(--primary) !important;
        font-weight: var(--font-weight-semi-bold);
    }
    .separator {
        width: 100%;
        height: 0.125rem;
        border-radius: var(--rad-md);
        background-color: var(--background-2);

        &.thick {
            height: 0.25rem;
        }
    }
</style>
