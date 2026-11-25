<script lang="ts">
    import {
        allUsersStore,
        platformModeratorStore,
        platformOperatorStore,
        type ModerationReportContent,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/core/Markdown.svelte";
    import { Body, BodySmall, ColourVars, Column, Row, Subtitle } from "component-lib";
    import { getContext } from "svelte";
        import { copyToClipboard } from "../../utils/urls";
    import Upheld from "svelte-material-icons/CheckCircleOutline.svelte";
    import Dismissed from "svelte-material-icons/CloseCircleOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import FileAuthorityReport from "./FileAuthorityReport.svelte";
    import { ncaReporterUrl } from "../../utils/ncaFiling";
    import VaultAccessLog from "./VaultAccessLog.svelte";
    import VaultMediaViewer from "./VaultMediaViewer.svelte";
    import {
        flaggedCategoryNames,
        hashMatchLine as formatHashMatchLine,
        reportIsCsamish,
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
    let csamish = $derived(reportIsCsamish(content));
    let categories = $derived(flaggedCategoryNames(content.flaggedCategories));
    let url = $derived(reportMessageUrl(content));
    let canResolve = $derived(card.canResolve);
    let checklistUrl = $derived(card.checklistUrl);
    let hasMedia = $derived(card.hasMedia);
    let needsMediaReview = $derived(card.needsMediaReview);
</script>

{#snippet reportCard()}
    <Column borderRadius="md" backgroundColor={ColourVars.surface1}>
        <Row
            padding="lg"
            backgroundColor={csam ? ColourVars.tertiarySurface : ColourVars.surface0}
            gap="md"
        >
            {#if csam}
                <span class="csam"
                    ><Translatable resourceKey={i18nKey("moderationReport.csam")} /></span
                >
            {/if}
            <Subtitle>
                <Translatable resourceKey={i18nKey("moderationReport.title")} />
            </Subtitle>
        </Row>
        {#if csamish}
            <Row backgroundColor={ColourVars.surface0} padding="lg" gap="md">
                <Body>
                    <Translatable resourceKey={i18nKey("moderationReport.vaultOnly")} />
                </Body>
            </Row>
        {/if}
        <Column padding="lg" gap="sm">
            <Row gap="md">
                <Body uppercase colour="textSecondary" width={{ size: "6rem" }}>
                    <Translatable resourceKey={i18nKey("moderationReport.sender")} />
                </Body>
                <Body>{sender}</Body>
            </Row>
            <Row gap="md">
                <Body uppercase colour="textSecondary" width={{ size: "6rem" }}>
                    <Translatable resourceKey={i18nKey("moderationReport.reporters")} />
                </Body>
                <Body>
                    {#if reporters.length === 0}
                        <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
                    {:else}
                        {reporters.join(", ")}
                    {/if}
                </Body>
            </Row>
            {#if categories.length > 0}
                <Row gap="md">
                    <Body uppercase colour="textSecondary" width={{ size: "6rem" }}>
                        <Translatable resourceKey={i18nKey("moderationReport.categories")} />
                    </Body>
                    {#each categories as category, i (i)}
                        <span class="category">
                            <BodySmall>
                                {category}
                            </BodySmall>
                        </span>
                    {/each}
                </Row>
            {/if}

            <Row gap="md">
                <Body uppercase colour="textSecondary" width={{ size: "6rem" }}>
                    <Translatable resourceKey={i18nKey("moderationReport.context")} />
                </Body>

                <Body>
                    {#if csamish}
                        <Translatable resourceKey={i18nKey("moderationReport.linkUnavailable")} />
                    {:else if url !== undefined}
                        <a class="link" href={url}
                            ><Translatable
                                resourceKey={i18nKey("moderationReport.viewMessage")}
                            /></a
                        >
                    {:else}
                        <Translatable resourceKey={i18nKey("moderationReport.privateChat")} />
                    {/if}
                </Body>
            </Row>
        </Column>
        {#if content.contentExcerpt !== undefined}
            <Column backgroundColor={ColourVars.surface0} padding="lg" gap="md">
                <BodySmall colour="textSecondary" uppercase>
                    <Translatable resourceKey={i18nKey("moderationReport.reportedMessage")} />
                </BodySmall>
                <blockquote class="excerpt">
                    <Markdown text={content.contentExcerpt} />
                </blockquote>
            </Column>
        {/if}
        {#if canResolve}
            {#if hasMedia}
                <Row
                    padding="lg"
                    backgroundColor={csam ? ColourVars.tertiarySurface : ColourVars.surface0}
                >
                    {#if csam}
                        <Column>
                            <BodySmall
                                ><Translatable
                                    resourceKey={i18nKey("moderationReport.quarantinedAttachment")}
                                /></BodySmall
                            >
                            <BodySmall colour="textSecondary"
                                ><Translatable
                                    resourceKey={i18nKey(
                                        "moderationReport.quarantinedAttachmentHint",
                                    )}
                                /></BodySmall
                            >
                        </Column>
                    {:else}
                        <Column>
                            <BodySmall
                                ><Translatable
                                    resourceKey={i18nKey("moderationReport.attachment")}
                                /></BodySmall
                            >
                            <BodySmall colour="textSecondary"
                                ><Translatable
                                    resourceKey={i18nKey("moderationReport.attachmentHint")}
                                /></BodySmall
                            >
                        </Column>
                    {/if}
                    <Button onClick={() => (showViewer = true)}>
                        <Translatable resourceKey={i18nKey("moderationReport.reviewMedia")} />
                    </Button>
                </Row>
            {/if}
        {/if}
        {#if content.autoSanctioned && hasMedia}
            <Row padding="lg" backgroundColor={ColourVars.surface0}>
                <Button secondary onClick={() => (showAccessLog = true)}>
                    <Translatable resourceKey={i18nKey("vaultLog.button")} />
                </Button>
            </Row>
        {/if}
    </Column>
{/snippet}

{#snippet statusLine()}
    {@const classifierLine = content.flaggedCategories === 0 && content.status.kind === "pending"}
    {#if (content.status.kind === "pending" || content.status.kind === "contested") && (classifierLine || content.status.kind === "contested" || content.autoSanctioned)}
        <Row gap="sm" wrap padding="lg" borderRadius="md" backgroundColor={ColourVars.surface1}>
            {#if classifierLine}
                <Body width="hug">
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
                <Body width="hug" fontWeight="bold" colour="validationError">
                    <Translatable resourceKey={i18nKey("moderationReport.contested")} />
                </Body>
            {/if}
            {#if content.autoSanctioned}
                <Body width="hug">
                    <Translatable resourceKey={i18nKey("moderationReport.sanctionPending")} />
                </Body>
            {/if}
        </Row>
    {/if}
{/snippet}

{#snippet resolution()}
    <Row
        crossAxisAlignment="center"
        gap="md"
        wrap
        padding="lg"
        borderRadius="md"
        backgroundColor={content.status.kind === "upheld_as_csam"
            ? ColourVars.tertiarySurface
            : ColourVars.surface1}
    >
        {#if content.status.kind === "dismissed"}
            <Dismissed color="var(--text-secondary)" size="1.6rem" />
            <Column>
                <Body
                    ><Translatable
                        resourceKey={i18nKey("moderationReport.resolvedDismissed")}
                    /></Body
                >
                <BodySmall colour="textSecondary"
                    ><Translatable
                        resourceKey={i18nKey("moderationReport.resolvedBySanctionReversed", {
                            moderator,
                        })}
                    /></BodySmall
                >
            </Column>
        {:else if content.status.kind === "upheld"}
            <Upheld color="var(--success)" size="1.6rem" />
            <Column>
                <Body
                    ><Translatable resourceKey={i18nKey("moderationReport.resolvedUpheld")} /></Body
                >
                <BodySmall colour="textSecondary"
                    ><Translatable
                        resourceKey={i18nKey("moderationReport.resolvedBy", { moderator })}
                    /></BodySmall
                >
            </Column>
        {:else if content.status.kind === "upheld_as_csam"}
            <Upheld color="var(--error)" size="1.6rem" />
            <Column>
                <Body
                    ><Translatable
                        resourceKey={i18nKey("moderationReport.resolvedUpheldCsam")}
                    /></Body
                >
                <BodySmall colour="textSecondary">
                    {#if content.autoSanctioned}
                        <Translatable
                            resourceKey={i18nKey("moderationReport.resolvedBySanctionStands", {
                                moderator,
                            })}
                        />
                    {:else}
                        <Translatable
                            resourceKey={i18nKey("moderationReport.resolvedBy", { moderator })}
                        />
                    {/if}
                </BodySmall>
            </Column>
        {/if}
    </Row>
{/snippet}

{#snippet actions()}
    <Column gap="sm">
        <Row gap="md">
            <Button loading={card.busy} disabled={card.busy || card.resolved} onClick={() => card.resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </Button>
            <Button
                loading={card.busy}
                danger
                disabled={card.busy || card.resolved}
                onClick={() => card.resolve("upheld_as_csam")}
            >
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </Button>
            <Button
                loading={card.busy}
                secondary
                disabled={card.busy || card.resolved}
                onClick={() => card.resolve("dismissed")}
            >
                <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
            </Button>
        </Row>

        <Row borderRadius="md" padding="lg" backgroundColor={ColourVars.tertiarySurface}>
            <Checkbox
                id={`urgent-${content.messageId}`}
                small
                label={i18nKey("moderationReport.urgent")}
                checked={card.urgent}
                onChange={() => (card.urgent = !card.urgent)}
            >
                <Column>
                    <Body
                        ><Translatable
                            resourceKey={i18nKey("moderationReport.urgentTitle")}
                        /></Body
                    >
                    <BodySmall colour="textSecondary"
                        ><Translatable
                            resourceKey={i18nKey("moderationReport.urgentHint")}
                        /></BodySmall
                    >
                </Column>
            </Checkbox>
        </Row>
    </Column>
{/snippet}

{#snippet authReport()}
    {#if authorityReport !== undefined}
        <Row
            crossAxisAlignment="center"
            gap="md"
            wrap
            padding="lg"
            borderRadius="md"
            backgroundColor={authorityReport.kind === "filed" ||
            authorityReport.kind === "attempting"
                ? ColourVars.surface1
                : ColourVars.tertiarySurface}
        >
            {#if authorityReport.kind === "due"}
                <Body
                    width="hug"
                    fontWeight="bold"
                    colour={authorityReport.urgent ? "validationError" : undefined}
                >
                    <Translatable
                        resourceKey={i18nKey(
                            authorityReport.urgent
                                ? "moderationReport.ncaDueUrgent"
                                : "moderationReport.ncaDue",
                        )}
                    />
                </Body>
                {#if canOpenFiling}
                    <Button tiny onClick={() => (showFiling = true)}>
                        <Translatable
                            resourceKey={i18nKey(
                                ncaReporterUrl !== ""
                                    ? "moderationReport.fileWithNca"
                                    : "moderationReport.recordFiling",
                            )} />
                    </Button>
                {/if}
                {#if hasMedia || mediaMatches.length > 0}
                    <Button tiny secondary disabled={card.hashCopyState !== "idle"} onClick={() => card.copyHashes()}>
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
                {/if}
                <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                    <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                </a>
            {:else if authorityReport.kind === "attempting"}
                <Body width="hug" fontWeight="bold" colour={attemptIsStale ? "validationError" : undefined}>
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
                        <Button
                            tiny
                            danger
                            disabled={card.clearingAttempt}
                            loading={card.clearingAttempt}
                            onClick={() => card.clearAttempt()}>
                            <Translatable resourceKey={i18nKey("moderationReport.clearAttempt")} />
                        </Button>
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
                <Column gap="md">
                    <Body fontWeight="bold" colour="validationError">
                        <span class="authority-error">
                            <Translatable
                                resourceKey={i18nKey("moderationReport.ncaContingency", {
                                    error: authorityReport.error,
                                })} />
                        </span>
                    </Body>
                    <Row gap="md" crossAxisAlignment="center">
                        {#if canOpenFiling}
                            <Button tiny onClick={() => (showFiling = true)}>
                                <Translatable
                                    resourceKey={i18nKey("moderationReport.retryFiling")} />
                            </Button>
                        {/if}
                        <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                            <Translatable
                                resourceKey={i18nKey("moderationReport.filingChecklist")} />
                        </a>
                    </Row>
                </Column>
            {:else if authorityReport.kind === "validation_failed"}
                <Column gap="md">
                    <Body fontWeight="bold" colour="validationError">
                        <span class="authority-error">
                            <Translatable
                                resourceKey={i18nKey("moderationReport.ncaValidationFailed", {
                                    error: authorityReport.error,
                                })} />
                        </span>
                    </Body>
                    <Row gap="md" crossAxisAlignment="center">
                        <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                            <Translatable
                                resourceKey={i18nKey("moderationReport.filingChecklist")} />
                        </a>
                    </Row>
                </Column>
            {:else if authorityReport.kind === "filed"}
                <Body width="hug">
                    <Translatable resourceKey={i18nKey("moderationReport.ncaFiled")} />: {authorityReport.portalReference}
                </Body>
            {/if}
        </Row>
    {/if}
{/snippet}

<Column gap="md" padding={["lg", "zero"]}>
    {@const status = content.status.kind}
    <!-- report -->
    {@render reportCard()}
    {#if mediaMatches.length > 0}
        <Row gap="sm" wrap padding="lg" borderRadius="md" backgroundColor={ColourVars.surface1}>
            <Body width="hug">
                <Translatable resourceKey={i18nKey("moderationReport.hashMatched")} />
                {hashMatchLine}
            </Body>
        </Row>
    {/if}
    {@render statusLine()}

    {#if status === "upheld" || status === "upheld_as_csam" || status === "dismissed"}
        {@render resolution()}
    {/if}

    {@render authReport()}

    {#if canResolve && gate.reviewerRequired}
        <Body colour="validationError">
            <Translatable resourceKey={i18nKey("moderationReport.reviewerRequired")} />
        </Body>
    {:else if canResolve && needsMediaReview && gate.fetchFailed}
        <Body colour="validationError">
            <Translatable resourceKey={i18nKey("moderationReport.mediaFetchFailed")} />
        </Body>
    {:else if canResolve && !needsMediaReview}
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
        {@render actions()}
    {/if}

    {#if card.failed}
        <Body colour="validationError">
            {#if card.failureReason !== undefined}
                {card.failureReason}
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            {/if}
        </Body>
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
    .category {
        background-color: var(--tertiary-muted);
        padding: 0 var(--sp-sm);
        border-radius: var(--rad-md);
    }
    .csam {
        @include font(bold, normal, fs-100);
        background-color: var(--error);
        color: #ffffff;
        border-radius: toRem(4);
        padding: toRem(1) toRem(6);
    }
    .excerpt {
        margin: 0;
        padding-left: $sp3;
        border-left: $sp1 solid var(--error);
        font-style: italic;
        white-space: pre-wrap;
    }
    .checklist-link {
        color: var(--secondary);
        text-decoration: underline;
        white-space: nowrap;
    }
    // Failure states quote raw error strings with long unbroken tokens (canister ids, urls)
    // which would otherwise overflow the card
    :global(.authority-error) {
        overflow-wrap: anywhere;
        min-width: 0;
    }
    .link {
        color: var(--secondary);
    }
</style>
