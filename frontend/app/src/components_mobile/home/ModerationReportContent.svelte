<script lang="ts">
    import {
        allUsersStore,
        platformModeratorStore,
        platformOperatorStore,
        type ModerationReportContent,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/core/Markdown.svelte";
    import { Body, BodySmall, Button, Column, Row, Subtitle, Switch } from "component-lib";
    import { getContext } from "svelte";
        import { copyToClipboard } from "../../utils/urls";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";
    import FileAuthorityReport from "./FileAuthorityReport.svelte";
    import { ncaReporterUrl } from "../../utils/ncaFiling";
    import VaultAccessLog from "./VaultAccessLog.svelte";
    import VaultMediaViewer from "./VaultMediaViewer.svelte";
    import {
        flaggedCategoryNames,
        hashMatchLine as formatHashMatchLine,
        reportIsCsam,
        reportMessageUrl,
        reportPeople,
    } from "@src/logic/moderation/moderationReport";
    import { ModerationReportCard } from "@src/logic/moderation/moderationReportCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: ModerationReportContent;
    }

    let { content }: Props = $props();

    // The card's state and what it offers are logic/moderation's (moderationReportCard), shared
    // with the other tree's card and the new web UI's
    const card = new ModerationReportCard(
        client,
        () => ({
            content,
            isModerator: $platformModeratorStore,
            isOperator: $platformOperatorStore,
        }),
        { ncaReporterUrl, copy: copyToClipboard },
    );
    const gate = card.gate;
    let showViewer = $state(false);
    let showAccessLog = $state(false);
    let showFiling = $state(false);
    let authorityReport = $derived(card.authorityReport);
    let attemptIsStale = $derived(card.attemptIsStale);
    let canOpenFiling = $derived(card.canOpenFiling);
    let people = $derived(reportPeople(content, (id) => $allUsersStore.get(id)?.username));
    let moderator = $derived(people.moderator);
    let sender = $derived(people.sender);
    let reporters = $derived(people.reporters);
    let csam = $derived(reportIsCsam(content));
    let mediaMatches = $derived(card.mediaMatches);
    let hashMatchLine = $derived(formatHashMatchLine(mediaMatches));
    let categories = $derived(flaggedCategoryNames(content.flaggedCategories).join(", "));
    let url = $derived(reportMessageUrl(content));
    let needsMediaReview = $derived(card.needsMediaReview);
    let checklistUrl = $derived(card.checklistUrl);
    let canResolve = $derived(card.canResolve);
</script>

<Column padding={["sm", "sm", "lg", "sm"]} gap="md">
    <Column>
        <Row gap="sm">
            {#if csam}
                <Subtitle width="hug" colour="validationError">
                    <Translatable resourceKey={i18nKey("moderationReport.csam")} />
                </Subtitle>
            {/if}
            <Subtitle>
                <Translatable resourceKey={i18nKey("moderationReport.title")} />
            </Subtitle>
        </Row>

        <BodySmall>
            {#if csam || content.status.kind === "upheld_as_csam"}
                <!-- Alleged or confirmed CSAM must never be viewed in place: the vault viewer
                     is the only sanctioned route -->
                <Translatable resourceKey={i18nKey("moderationReport.vaultOnly")} />
            {:else if url !== undefined}
                <a class="link" href={url}
                    ><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a
                >
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.privateChat")} />
            {/if}
        </BodySmall>
    </Column>

    <Column gap="xs">
        <Body colour="textSecondary">
            <Translatable resourceKey={i18nKey("moderationReport.sender")} />: {sender}
        </Body>

        <Body colour="textSecondary">
            {#if reporters.length === 0}
                <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.reporters")} />: {reporters.join(
                    ", ",
                )}
            {/if}
        </Body>

        {#if categories !== ""}
            <Body colour="textSecondary">
                <Translatable resourceKey={i18nKey("moderationReport.categories")} />: {categories}
            </Body>
        {/if}
        {#if content.flaggedCategories === 0 && content.status.kind === "pending"}
            <Body colour="textSecondary">
                <Translatable
                    resourceKey={i18nKey(
                        content.classificationFailed
                            ? "moderationReport.classifierFailed"
                            : "moderationReport.classifierClean",
                    )}
                />
            </Body>
        {/if}
        {#if content.status.kind === "contested"}
            <Body colour="validationError" fontWeight="bold">
                <Translatable resourceKey={i18nKey("moderationReport.contested")} />
            </Body>
        {/if}
        {#if content.autoSanctioned}
            <Body colour="textSecondary">
                {#if content.status.kind === "pending" || content.status.kind === "contested"}
                    <Translatable resourceKey={i18nKey("moderationReport.sanctionPending")} />
                {:else}
                    <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
                {/if}
            </Body>
        {/if}
        {#if mediaMatches.length > 0}
            <Body colour="textSecondary">
                <Translatable resourceKey={i18nKey("moderationReport.hashMatched")} />
                {hashMatchLine}
            </Body>
        {/if}
    </Column>

    {#if content.contentExcerpt !== undefined}
        <Row padding={["md", "zero"]}>
            <blockquote class="excerpt">
                <Markdown text={content.contentExcerpt} />
            </blockquote>
        </Row>
    {/if}

    {#if authorityReport !== undefined}
        <Column gap="sm">
            {#if authorityReport.kind === "due"}
                <Body fontWeight="bold" colour={authorityReport.urgent ? "validationError" : "textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            authorityReport.urgent
                                ? "moderationReport.ncaDueUrgent"
                                : "moderationReport.ncaDue",
                        )}
                    />
                </Body>
                {#if canOpenFiling}
                    <Row gap="sm">
                        <Button secondary onClick={() => (showFiling = true)}>
                            <Translatable
                                resourceKey={i18nKey(
                                    ncaReporterUrl !== ""
                                        ? "moderationReport.fileWithNca"
                                        : "moderationReport.recordFiling",
                                )} />
                        </Button>
                    </Row>
                {/if}
                {#if content.blobReferences.length > 0 || mediaMatches.length > 0}
                    <Row gap="sm">
                        <Button secondary disabled={card.hashCopyState !== "idle"} onClick={() => card.copyHashes()}>
                            <Translatable
                                resourceKey={i18nKey(
                                    card.hashCopyState === "idle"
                                        ? "moderationReport.copyHashes"
                                        : card.hashCopyState === "copied"
                                          ? "moderationReport.hashesCopied"
                                          : "moderationReport.hashesFailed",
                                )}
                            />
                        </Button>
                    </Row>
                {/if}
                <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                    <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                </a>
            {:else if authorityReport.kind === "attempting"}
                <Body fontWeight="bold" colour={attemptIsStale ? "validationError" : "textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            attemptIsStale
                                ? "moderationReport.ncaAttemptingStale"
                                : "moderationReport.ncaAttempting",
                            {
                                when: new Date(
                                    Number(authorityReport.startedAt),
                                ).toLocaleString(),
                            },
                        )} />
                </Body>
                {#if attemptIsStale}
                    {#if $platformOperatorStore && !card.attemptCleared}
                        <Row gap="sm">
                            <Button
                                danger
                                disabled={card.clearingAttempt}
                                loading={card.clearingAttempt}
                                onClick={() => card.clearAttempt()}>
                                <Translatable
                                    resourceKey={i18nKey("moderationReport.clearAttempt")} />
                            </Button>
                        </Row>
                    {/if}
                    <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                        <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                    </a>
                    {#if card.clearAttemptFailed}
                        <Body colour="validationError">
                            <Translatable
                                resourceKey={i18nKey("moderationReport.clearAttemptFailed")} />
                        </Body>
                    {/if}
                {/if}
            {:else if authorityReport.kind === "contingency_required"}
                <Body fontWeight="bold" colour="validationError">
                    <span class="authority-error">
                        <Translatable
                            resourceKey={i18nKey("moderationReport.ncaContingency", {
                                error: authorityReport.error,
                            })} />
                    </span>
                </Body>
                {#if canOpenFiling}
                    <Row gap="sm">
                        <Button secondary onClick={() => (showFiling = true)}>
                            <Translatable resourceKey={i18nKey("moderationReport.retryFiling")} />
                        </Button>
                    </Row>
                {/if}
                <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                    <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                </a>
            {:else if authorityReport.kind === "validation_failed"}
                <Body fontWeight="bold" colour="validationError">
                    <span class="authority-error">
                        <Translatable
                            resourceKey={i18nKey("moderationReport.ncaValidationFailed", {
                                error: authorityReport.error,
                            })} />
                    </span>
                </Body>
                <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                    <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                </a>
            {:else if authorityReport.kind === "filed"}
                <Body colour="textSecondary">
                    <Translatable resourceKey={i18nKey("moderationReport.ncaFiled")} />: {authorityReport.portalReference}
                </Body>
            {/if}
        </Column>
    {/if}

    {#if content.status.kind === "upheld" || content.status.kind === "upheld_as_csam"}
        <Body colour="textSecondary" fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.upheld", {
                    moderator,
                })}
            />
        </Body>
    {:else if content.status.kind === "dismissed"}
        <Body colour="textSecondary" fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.dismissed", {
                    moderator,
                })}
            />
        </Body>
    {:else if canResolve}
        {#if content.blobReferences.length > 0}
            <Row gap="sm">
                <Button secondary onClick={() => (showViewer = true)}>
                    <Translatable resourceKey={i18nKey("moderationReport.reviewMedia")} />
                </Button>
                {#if content.autoSanctioned}
                    <Button secondary onClick={() => (showAccessLog = true)}>
                        <Translatable resourceKey={i18nKey("vaultLog.button")} />
                    </Button>
                {/if}
            </Row>
        {/if}
        {#if gate.reviewerRequired}
            <Body colour="validationError" fontWeight="bold">
                <Translatable resourceKey={i18nKey("moderationReport.reviewerRequired")} />
            </Body>
        {/if}
        {#if gate.unavailable}
            <Body colour="validationError">
                <Translatable resourceKey={i18nKey("moderationReport.mediaUnavailable")} />
            </Body>
        {/if}
        {#if gate.unplayable}
            <Body colour="validationError">
                <Translatable resourceKey={i18nKey("moderationReport.mediaUnplayable")} />
            </Body>
        {/if}
        {#if needsMediaReview && gate.fetchFailed}
            <Body colour="validationError">
                <Translatable resourceKey={i18nKey("moderationReport.mediaFetchFailed")} />
            </Body>
        {/if}
        {#if !needsMediaReview && !gate.reviewerRequired}
            <Row gap="sm">
                <Switch bind:checked={card.urgent}>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("moderationReport.urgent")} />
                    </Body>
                </Switch>
            </Row>
            <Row gap="sm" padding={["zero", "zero", "md", "zero"]}>
                <Button
                    disabled={card.busy || card.resolved}
                    loading={card.busy}
                    onClick={() => card.resolve("upheld")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
                </Button>
                <Button
                    danger
                    disabled={card.busy || card.resolved}
                    loading={card.busy}
                    onClick={() => card.resolve("upheld_as_csam")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
                </Button>
                <Button
                    secondary
                    disabled={card.busy || card.resolved}
                    loading={card.busy}
                    onClick={() => card.resolve("dismissed")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
                </Button>
            </Row>
        {/if}
        {#if card.failed}
            <Body colour="validationError" fontWeight="bold">
                {#if card.failureReason !== undefined}
                    {card.failureReason}
                {:else}
                    <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                {/if}
            </Body>
        {/if}
    {/if}

    <!-- The access log stays reachable after the report is resolved (parity with desktop):
         chain-of-custody review is most useful once the case is closed -->
    {#if !canResolve && content.autoSanctioned && content.blobReferences.length > 0}
        <Row gap="sm">
            <Button secondary onClick={() => (showAccessLog = true)}>
                <Translatable resourceKey={i18nKey("vaultLog.button")} />
            </Button>
        </Row>
    {/if}
</Column>

{#if showFiling && content.reportIndex !== undefined && authorityReport !== undefined && authorityReport.kind !== "filed" && authorityReport.kind !== "attempting"}
    <FileAuthorityReport
        reportIndex={content.reportIndex}
        urgent={authorityReport.urgent}
        onFiled={(ref) => {
            card.filed(ref);
            showFiling = false;
        }}
        onFilingStarted={() => card.filingStarted()}
        onClose={() => (showFiling = false)}
    />
{/if}

{#if showAccessLog}
    <VaultAccessLog
        blobReferences={content.blobReferences}
        onClose={() => (showAccessLog = false)}
    />
{/if}

{#if showViewer}
    <VaultMediaViewer
        blobReferences={content.blobReferences}
        quarantined={content.autoSanctioned}
        onResult={(outcome) => gate.apply(outcome)}
        onClose={() => (showViewer = false)}
    />
{/if}

<style lang="scss">
    :global(.authority-error) {
        overflow-wrap: anywhere;
        min-width: 0;
    }
    .checklist-link {
        color: var(--secondary);
        text-decoration: underline;
        white-space: nowrap;
    }
    .link {
        color: var(--secondary) !important;
    }
    .excerpt {
        margin: 0;
        padding-left: var(--sp-sm);
        border-left: var(--sp-xs) solid var(--validation-error);
        font-style: italic;
        white-space: pre-wrap;
    }
</style>
