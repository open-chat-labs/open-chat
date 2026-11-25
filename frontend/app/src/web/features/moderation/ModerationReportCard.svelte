<!-- A moderation report in the moderation channel (`moderation_report_content`, L6c), drawn in the
     conversation through MessageGroup's `customContent`: the old desktop card ported plainly, on
     the shared card logic (logic/moderation's moderationReport and ModerationReportCard), with the
     same client calls. The report: CSAM marked, who sent and reported it, the flagged categories,
     a link to the message (none for a DM's, nor for alleged or confirmed CSAM, which is only ever
     seen through the vault), the reported text. For a platform moderator while it's pending or
     contested: Review media first where it has media (the verdicts stay locked until it's been
     seen, unless the moderator isn't a vault reviewer or the media's gone or won't play), then
     Uphold, CSAM (with the urgent flag) or Dismiss. Once decided, the verdict and who gave it. The
     NCA filing state: Due (file with the NCA, or record a filing; copy the hashes; the manual
     checklist), under way (stale: an operator clears it), failed, filed. The access log of
     quarantined media. The media review, access log and filing are dialogs of their own
     (`onOpenDialog`).
     TODO(design): the design has no moderation report card; library parts with the old desktop
     card's layout and words. -->
<script lang="ts">
    import {
        allUsersStore,
        platformModeratorStore,
        platformOperatorStore,
        type InterpolationValues,
        type ModerationReportContent,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import {
        flaggedCategoryNames,
        hashMatchLine,
        reportIsCsam,
        reportIsCsamish,
        reportMessageUrl,
        reportPeople,
    } from "@src/logic/moderation/moderationReport";
    import { ModerationReportCard } from "@src/logic/moderation/moderationReportCard.svelte";
    import { ncaReporterUrl } from "@src/utils/ncaFiling";
    import { copyToClipboard } from "@src/utils/urls";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LocalDialog } from "../app/dialogs";

    interface Props {
        content: ModerationReportContent;
        /** Opens the card's media review, access log or filing dialog. */
        onOpenDialog: (dialog: LocalDialog) => void;
    }

    let { content, onOpenDialog }: Props = $props();

    const client = getContext<OpenChat>("client");
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

    const people = $derived(reportPeople(content, (id) => $allUsersStore.get(id)?.username));
    const csam = $derived(reportIsCsam(content));
    const csamish = $derived(reportIsCsamish(content));
    const categories = $derived(flaggedCategoryNames(content.flaggedCategories));
    const url = $derived(reportMessageUrl(content));
    const matches = $derived(card.mediaMatches);
    const status = $derived(content.status.kind);
    const open = $derived(status === "pending" || status === "contested");
    const classifierLine = $derived(content.flaggedCategories === 0 && status === "pending");
    const report = $derived(card.authorityReport);
    const text = (key: string, params?: InterpolationValues) =>
        interpolateNewUi($_, i18nKey(key, params));

    function reviewMedia() {
        onOpenDialog({
            kind: "vault_media",
            blobReferences: content.blobReferences,
            quarantined: content.autoSanctioned,
            onResult: (outcome) => gate.apply(outcome),
        });
    }

    function accessLog() {
        onOpenDialog({ kind: "vault_access_log", blobReferences: content.blobReferences });
    }

    function file() {
        const reportIndex = content.reportIndex;
        if (reportIndex === undefined || !card.filingOpen) return;
        onOpenDialog({
            kind: "nca_filing",
            reportIndex,
            urgent: card.filingUrgent,
            onFiled: (ref) => card.filed(ref),
            onFilingStarted: () => card.filingStarted(),
            stillDue: () => card.filingOpen,
        });
    }
</script>

{#snippet checklist()}
    <a class="link" href={card.checklistUrl} target="_blank" rel="noreferrer">
        {$_("moderationReport.filingChecklist")}
    </a>
{/snippet}

<div class="moderation">
    <section class="card">
        <header class="head" class:csam>
            {#if csam}
                <Pill label={$_("moderationReport.csam")} tone="danger" size="sm" />
            {/if}
            <h4 class="title">{$_("moderationReport.title")}</h4>
        </header>
        {#if csamish}
            <p class="band">{$_("moderationReport.vaultOnly")}</p>
        {/if}
        <dl class="facts">
            <dt>{$_("moderationReport.sender")}</dt>
            <dd>{people.sender}</dd>
            <dt>{$_("moderationReport.reporters")}</dt>
            <dd>
                {people.reporters.length === 0
                    ? $_("moderationReport.pipeline")
                    : people.reporters.join(", ")}
            </dd>
            {#if categories.length > 0}
                <dt>{$_("moderationReport.categories")}</dt>
                <dd class="pills">
                    {#each categories as category (category)}
                        <Pill label={category} tone="warning" size="sm" />
                    {/each}
                </dd>
            {/if}
            <dt>{$_("moderationReport.context")}</dt>
            <dd>
                {#if csamish}
                    {$_("moderationReport.linkUnavailable")}
                {:else if url !== undefined}
                    <a class="link" href={url}>{$_("moderationReport.viewMessage")}</a>
                {:else}
                    {$_("moderationReport.privateChat")}
                {/if}
            </dd>
        </dl>
        {#if content.contentExcerpt !== undefined}
            <div class="excerpt">
                <span class="label">{$_("moderationReport.reportedMessage")}</span>
                <blockquote><Markdown text={content.contentExcerpt} /></blockquote>
            </div>
        {/if}
        {#if card.canResolve && card.hasMedia}
            <div class="band media" class:csam>
                <div class="what">
                    <span class="strong">
                        {$_(
                            csam
                                ? "moderationReport.quarantinedAttachment"
                                : "moderationReport.attachment",
                        )}
                    </span>
                    <span class="muted">
                        {$_(
                            csam
                                ? "moderationReport.quarantinedAttachmentHint"
                                : "moderationReport.attachmentHint",
                        )}
                    </span>
                </div>
                <Button label={$_("moderationReport.reviewMedia")} onClick={reviewMedia} />
            </div>
        {/if}
        {#if content.autoSanctioned && card.hasMedia}
            <div class="band">
                <Button label={$_("vaultLog.button")} variant="secondary" onClick={accessLog} />
            </div>
        {/if}
    </section>

    {#if matches.length > 0}
        <p class="line">{$_("moderationReport.hashMatched")} {hashMatchLine(matches)}</p>
    {/if}

    {#if open && (classifierLine || status === "contested" || content.autoSanctioned)}
        <div class="line">
            {#if classifierLine}
                <span>
                    {$_(
                        content.classificationFailed
                            ? "moderationReport.classifierFailed"
                            : "moderationReport.classifierClean",
                    )}
                </span>
            {/if}
            {#if status === "contested"}
                <span class="strong danger">{$_("moderationReport.contested")}</span>
            {/if}
            {#if content.autoSanctioned}
                <span>{$_("moderationReport.sanctionPending")}</span>
            {/if}
        </div>
    {/if}

    {#if status === "upheld" || status === "upheld_as_csam" || status === "dismissed"}
        <div class="line verdict" class:csam={status === "upheld_as_csam"}>
            {#if status === "dismissed"}
                <Pill label={$_("moderationReport.resolvedDismissed")} tone="neutral" />
                <span class="muted">
                    {text("moderationReport.resolvedBySanctionReversed", {
                        moderator: people.moderator,
                    })}
                </span>
            {:else if status === "upheld"}
                <Pill label={$_("moderationReport.resolvedUpheld")} tone="success" />
                <span class="muted">
                    {text("moderationReport.resolvedBy", { moderator: people.moderator })}
                </span>
            {:else}
                <Pill label={$_("moderationReport.resolvedUpheldCsam")} tone="danger" />
                <span class="muted">
                    {text(
                        content.autoSanctioned
                            ? "moderationReport.resolvedBySanctionStands"
                            : "moderationReport.resolvedBy",
                        { moderator: people.moderator },
                    )}
                </span>
            {/if}
        </div>
    {/if}

    {#if report !== undefined}
        <div class="line filing" class:due={report.kind !== "filed" && report.kind !== "attempting"}>
            {#if report.kind === "due"}
                <span class="strong" class:danger={report.urgent}>
                    {$_(report.urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue")}
                </span>
                <div class="buttons">
                    {#if card.canOpenFiling}
                        <Button
                            label={$_(
                                card.automatedFiling
                                    ? "moderationReport.fileWithNca"
                                    : "moderationReport.recordFiling",
                            )}
                            onClick={file} />
                    {/if}
                    {#if card.hasMedia || matches.length > 0}
                        <Button
                            label={$_(
                                card.hashCopyState === "idle"
                                    ? "moderationReport.copyHashes"
                                    : card.hashCopyState === "copied"
                                      ? "moderationReport.hashesCopied"
                                      : "moderationReport.hashesFailed",
                            )}
                            variant="secondary"
                            disabled={card.hashCopyState !== "idle"}
                            onClick={() => void card.copyHashes()} />
                    {/if}
                    {@render checklist()}
                </div>
            {:else if report.kind === "attempting"}
                <span class="strong" class:danger={card.attemptIsStale}>
                    {text(
                        card.attemptIsStale
                            ? "moderationReport.ncaAttemptingStale"
                            : "moderationReport.ncaAttempting",
                        { when: new Date(Number(report.startedAt)).toLocaleString() },
                    )}
                </span>
                {#if card.attemptIsStale}
                    <div class="buttons">
                        {#if card.isOperator && !card.attemptCleared}
                            <Button
                                label={$_("moderationReport.clearAttempt")}
                                variant="danger"
                                busy={card.clearingAttempt}
                                onClick={() => void card.clearAttempt()} />
                        {/if}
                        {@render checklist()}
                    </div>
                    {#if card.clearAttemptFailed}
                        <span class="danger">{$_("moderationReport.clearAttemptFailed")}</span>
                    {/if}
                {/if}
            {:else if report.kind === "contingency_required"}
                <span class="strong danger raw">
                    {text("moderationReport.ncaContingency", { error: report.error })}
                </span>
                <div class="buttons">
                    {#if card.canOpenFiling}
                        <Button label={$_("moderationReport.retryFiling")} onClick={file} />
                    {/if}
                    {@render checklist()}
                </div>
            {:else if report.kind === "validation_failed"}
                <span class="strong danger raw">
                    {text("moderationReport.ncaValidationFailed", { error: report.error })}
                </span>
                <div class="buttons">{@render checklist()}</div>
            {:else}
                <span>{$_("moderationReport.ncaFiled")}: {report.portalReference}</span>
            {/if}
        </div>
    {/if}

    {#if card.canResolve && gate.reviewerRequired}
        <p class="note danger">{$_("moderationReport.reviewerRequired")}</p>
    {:else if card.canResolve && card.needsMediaReview && gate.fetchFailed}
        <p class="note danger">{$_("moderationReport.mediaFetchFailed")}</p>
    {:else if card.canResolve && !card.needsMediaReview}
        {#if gate.unavailable}
            <p class="note danger">{$_("moderationReport.mediaUnavailable")}</p>
        {/if}
        {#if gate.unplayable}
            <p class="note danger">{$_("moderationReport.mediaUnplayable")}</p>
        {/if}
        <div class="verdicts">
            <div class="buttons">
                <Button
                    label={$_("moderationReport.uphold")}
                    disabled={card.resolved}
                    busy={card.busy}
                    onClick={() => void card.resolve("upheld")} />
                <Button
                    label={$_("moderationReport.upholdCsam")}
                    variant="danger"
                    disabled={card.resolved}
                    busy={card.busy}
                    onClick={() => void card.resolve("upheld_as_csam")} />
                <Button
                    label={$_("moderationReport.dismiss")}
                    variant="secondary"
                    disabled={card.resolved}
                    busy={card.busy}
                    onClick={() => void card.resolve("dismissed")} />
            </div>
            <div class="band csam urgent">
                <Toggle
                    on={card.urgent}
                    label={$_("moderationReport.urgentTitle")}
                    help={$_("moderationReport.urgentHint")}
                    onChange={(on) => (card.urgent = on)} />
            </div>
        </div>
    {/if}

    {#if card.failed}
        <p class="note danger" role="alert">
            {card.failureReason ?? $_("moderationReport.failed")}
        </p>
    {/if}
</div>

<style lang="scss">
    .moderation {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        width: 100%;
        font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
        color: var(--ink);
    }

    .card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
    }

    .head {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-12) var(--space-14);
        background: var(--surface-2);

        &.csam {
            background: var(--status-danger-soft);
        }
    }

    .title {
        margin: 0;
        font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    }

    .band {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        margin: 0;
        padding: var(--space-12) var(--space-14);
        background: var(--surface-2);

        &.csam {
            background: var(--status-danger-soft);
        }
    }

    .media .what {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .facts {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-6) var(--space-14);
        margin: 0;
        padding: var(--space-12) var(--space-14);

        dt {
            font: var(--weight-medium) var(--text-xs) / 1.8 var(--font-sans);
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--ink-3);
        }

        dd {
            margin: 0;
            overflow-wrap: anywhere;
        }
    }

    .pills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-4);
    }

    .excerpt {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-12) var(--space-14);
        background: var(--surface-2);

        .label {
            font: var(--weight-medium) var(--text-xs) / 1.4 var(--font-sans);
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--ink-3);
        }

        blockquote {
            margin: 0;
            padding-left: var(--space-12);
            border-left: 3px solid var(--status-danger);
            font-style: italic;
            white-space: pre-wrap;
        }
    }

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-8);
        margin: 0;
        padding: var(--space-12) var(--space-14);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);

        &.csam,
        &.due {
            background: var(--status-danger-soft);
        }

        &.filing {
            flex-direction: column;
            align-items: flex-start;
        }
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-8);
    }

    .verdicts {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);

        .urgent {
            border-radius: var(--radius-lg);
        }
    }

    .note {
        margin: 0;
    }

    .strong {
        font-weight: var(--weight-semibold);
    }

    .muted {
        color: var(--ink-3);
    }

    .danger {
        color: var(--status-danger);
    }

    // failure states quote raw error strings with long unbroken tokens (canister ids, urls)
    .raw {
        overflow-wrap: anywhere;
        min-width: 0;
    }

    .link {
        color: var(--accent);
        text-decoration: underline;
        white-space: nowrap;
    }
</style>
