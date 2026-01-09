<script lang="ts">
    import {
        Body,
        BodySmall,
        Caption,
        ChatText,
        ColourVars,
        Column,
        CommonButton,
        ReadMore,
        Row,
        Sheet,
        Subtitle,
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
    import ExpandIcon from "svelte-material-icons/ArrowExpandDown.svelte";
    import Launch from "svelte-material-icons/Launch.svelte";
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { NamedNeurons } from "../../../stores/namedNeurons";
    import { proposalVotes } from "../../../stores/proposalVotes";
    import { now } from "../../../stores/time";
    import { toastStore } from "../../../stores/toast";
    import { round2 } from "../../../utils/math";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import ProposalProgressLayout from "./ProposalProgressLayout.svelte";
    import ProposalVoteButton from "./ProposalVoteButton.svelte";
    import ProposalVotingProgress from "./ProposalVotingProgress.svelte";

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
    let showPayload = $state(false);
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

    function onClick() {
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
        0: ColourVars.error,
        1: ColourVars.error,
        2: ColourVars.warning,
        3: ColourVars.error,
        4: ColourVars.success,
        5: ColourVars.success,
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
</script>

{#snippet header()}
    <Column gap={"xs"}>
        {#if proposal.url.length > 0}
            <a href={proposal.url} rel="noreferrer" target="_blank">
                <Row crossAxisAlignment={"center"}>
                    <Body fontWeight={"bold"} width={"hug"} ellipsisTruncate>
                        {proposal.title}
                    </Body>
                    <Launch />
                </Row>
            </a>
        {:else}
            <Body fontWeight={"bold"} width={"hug"} ellipsisTruncate>
                {proposal.title}
            </Body>
        {/if}
        <Row crossAxisAlignment={"center"} gap={"sm"}>
            <Row
                width={"hug"}
                borderRadius={"md"}
                padding={["xxs", "sm"]}
                backgroundColor={statusColour[proposal.status]}>
                <BodySmall width={"hug"} colour={"textPrimary"}>
                    {ProposalDecisionStatus[proposal.status]}
                </BodySmall>
            </Row>
            {#if !payloadEmpty}
                <Row onClick={() => (showPayload = true)} gap={"xs"} crossAxisAlignment={"center"}>
                    <BodySmall colour={"textSecondary"} width={"hug"}>
                        <Translatable resourceKey={i18nKey("proposal.details")} />
                    </BodySmall>
                    <OpenInNew color={ColourVars.textSecondary} />
                </Row>
            {/if}
        </Row>
    </Column>
{/snippet}

{#snippet summary()}
    <ReadMore>
        <Body fontWeight={"light"}>
            <Markdown text={proposal.summary} inline={false} />
        </Body>
    </ReadMore>
{/snippet}

{#snippet metadata()}
    <Row wrap crossAxisAlignment={"center"} gap={"xs"}>
        <Caption colour={"textSecondary"} width={"hug"}>
            <a href={proposalUrl} rel="noreferrer" target="_blank">{proposal.id}</a>
        </Caption>
        <Caption colour={"primary"} width={"hug"}>|</Caption>
        <Caption colour={"textSecondary"} width={"hug"}>
            {typeValue}
        </Caption>
        <Caption colour={"primary"} width={"hug"}>|</Caption>
        <Caption colour={"textSecondary"} width={"hug"}>
            <Translatable resourceKey={i18nKey("proposal.proposedBy")} />
        </Caption>
        <Caption colour={"textSecondary"} width={"hug"}>
            <a target="_blank" rel="noreferrer" href={proposerUrl}
                >{renderNeuronId(proposal.proposer)}</a>
        </Caption>
    </Row>
{/snippet}

{#snippet progress()}
    <ProposalProgressLayout>
        {#snippet adopt()}
            <ProposalVoteButton
                voting={voteStatus === "adopting"}
                voted={voteStatus === "adopted"}
                disabled={votingDisabled}
                mode={"yes"}
                onClick={() => onVote(true)}
                percentage={adoptPercent} />
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

        {#snippet reject()}
            <ProposalVoteButton
                voting={voteStatus === "rejecting"}
                voted={voteStatus === "rejected"}
                disabled={votingDisabled}
                mode={"no"}
                onClick={() => onVote(false)}
                percentage={rejectPercent} />
        {/snippet}
    </ProposalProgressLayout>
{/snippet}

{#if collapsed}
    <Row padding={"sm"} {onClick} crossAxisAlignment={"center"} gap={"sm"}>
        <ChatText>
            {proposal.title}
        </ChatText>
        <ExpandIcon />
    </Row>
{:else}
    <Column padding={"sm"} gap={"lg"}>
        {@render header()}
        {@render summary()}
        {@render progress()}
        {@render metadata()}
    </Column>
{/if}

{#if showNeuronInfo}
    <Sheet onDismiss={() => (showNeuronInfo = false)}>
        <Column gap={"xl"} padding={"xl"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("proposal.noEligibleNeurons")} />
            </Subtitle>
            <Markdown
                text={$_("proposal.noEligibleNeuronsMessage", {
                    values: { userId: $currentUserIdStore },
                })} />
            <Row mainAxisAlignment={"end"}>
                <CommonButton
                    size={"medium"}
                    mode={"active"}
                    onClick={() => (showNeuronInfo = false)}>
                    <Translatable resourceKey={i18nKey("close")} />
                </CommonButton>
            </Row>
        </Column>
    </Sheet>
{/if}

{#if showPayload && !payloadEmpty}
    <Sheet onDismiss={() => (showPayload = false)}>
        <Column gap={"xl"} padding={"xl"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("proposal.details")} />
            </Subtitle>
            <Markdown text={payload ?? ""} inline={false} />
            <Row mainAxisAlignment={"end"}>
                <CommonButton size={"medium"} mode={"active"} onClick={() => (showPayload = false)}>
                    <Translatable resourceKey={i18nKey("close")} />
                </CommonButton>
            </Row>
        </Column>
    </Sheet>
{/if}
