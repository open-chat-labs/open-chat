<script lang="ts">
    import {
        allUsersStore,
        MODERATION_CATEGORY_NAMES,
        platformModeratorStore,
        platformOperatorStore,
        routeForMessage,
        type ModerationReportContent,
        type ModerationVerdict,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/components_shared/Markdown.svelte";
    import { Body, BodySmall, Button, Column, Row, Subtitle, Switch } from "component-lib";
    import { getContext } from "svelte";
        import { copyToClipboard } from "../../utils/urls";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import FileAuthorityReport from "./FileAuthorityReport.svelte";
    import { ncaReporterUrl } from "../../utils/ncaFiling";
    import VaultAccessLog from "./VaultAccessLog.svelte";
    import VaultMediaViewer from "./VaultMediaViewer.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: ModerationReportContent;
    }

    let { content }: Props = $props();

    let busy = $state(false);
    let failed = $state(false);
    // The canister explains WHY a verdict was refused (your own assertion, already
    // resolved); showing "failed" alone leaves the moderator guessing
    let failureReason: string | undefined = $state(undefined);
    let resolved = $state(false);
    let urgent = $state(false);
    let showViewer = $state(false);
    let showAccessLog = $state(false);
    let showFiling = $state(false);
    // Set once a filing is recorded from this card, ahead of the content update round-trip
    let filedReference = $state<string | undefined>(undefined);
    // Set once an automated filing was accepted by the reporting service, ahead of the
    // on-chain attempt marker reaching the card
    let filingStarted = $state(false);
    let authorityReport = $derived(
        filedReference !== undefined
            ? { kind: "filed" as const, portalReference: filedReference }
            : filingStarted && content.authorityReport?.kind === "due"
              ? { kind: "attempting" as const, startedAt: BigInt(Date.now()) }
              : content.authorityReport,
    );
    // An attempt marker much older than a filing takes means the service crashed mid-flight:
    // a human must check the portal before anything re-files
    const STALE_ATTEMPT_MS = 30 * 60 * 1000;
    let attemptIsStale = $derived(
        authorityReport?.kind === "attempting" &&
            Date.now() - Number(authorityReport.startedAt) > STALE_ATTEMPT_MS,
    );
    let canOpenFiling = $derived(
        content.reportIndex !== undefined &&
            ($platformOperatorStore || (ncaReporterUrl !== "" && $platformModeratorStore)),
    );
    // A verdict on a media report requires the media to have been reviewed first: deciding
    // without looking is exactly what this system exists to prevent
    let mediaReviewed = $state(false);
    let reviewerRequired = $state(false);
    let mediaUnavailable = $state(false);
    let mediaFetchFailed = $state(false);

    function onReviewResult(outcome: "viewed" | "not_authorized" | "not_found" | "error") {
        if (outcome === "viewed") {
            mediaReviewed = true;
        } else if (outcome === "not_authorized") {
            reviewerRequired = true;
        } else if (outcome === "not_found") {
            // The media genuinely no longer exists, so the review requirement is satisfied
            // with an advisory note; a transient fetch failure keeps the gate shut instead
            mediaUnavailable = true;
            mediaReviewed = true;
        } else {
            mediaFetchFailed = true;
        }
    }

    let moderatorId = $derived(
        content.status.kind !== "pending" && content.status.kind !== "contested"
            ? content.status.moderator
            : undefined,
    );
    let moderator = $derived(
        moderatorId ? ($allUsersStore.get(moderatorId)?.username ?? moderatorId) : undefined,
    );
    let sender = $derived($allUsersStore.get(content.sender)?.username ?? content.sender);
    let reporters = $derived(content.reporters.map((r) => $allUsersStore.get(r)?.username ?? r));
    // autoSanctioned always means CSAM (classifier detection, reporter assertion, or a
    // protective quarantine applied after classification): the flagged bits alone miss the
    // assertion cases, and the card must show the CSAM treatment (no in-place viewing)
    let csam = $derived((content.flaggedCategories & 2) !== 0 || content.autoSanctioned);
    // Non-empty when the detection was a media hash match rather than the text classifier.
    // Report content restored from the IndexedDB cache can pre-date the field entirely.
    let mediaMatches = $derived(content.mediaMatches ?? []);
    let hashMatchLine = $derived(
        mediaMatches
            .map(
                (m) =>
                    `${m.provider}${m.matchId !== undefined ? ` record ${m.matchId}` : ""} (distance ${m.matchDistance})`,
            )
            .join("; "),
    );
    let categories = $derived(
        MODERATION_CATEGORY_NAMES.filter(([bit, _name]) => (content.flaggedCategories & bit) !== 0)
            .map(([_bit, name]) => name)
            .join(", "),
    );
    // Direct-chat routes resolve relative to the viewer, so a link to someone
    // else's private chat would be dead for moderators — show no link instead.
    let url = $derived(
        content.chatId.kind === "direct_chat"
            ? undefined
            : routeForMessage(
                  content.chatId.kind === "channel" ? "community" : "chats",
                  {
                      chatId: content.chatId,
                      threadRootMessageIndex: content.threadRootMessageIndex,
                  },
                  content.messageIndex,
              ),
    );
    let needsMediaReview = $derived(content.blobReferences.length > 0 && !mediaReviewed);
    // Assembles the hash lines for the NCA report: the vault sha256 per quarantined blob
    // (reviewer-gated query) plus the scanner's perceptual hash per match
    let hashCopyState = $state<"idle" | "copied" | "failed">("idle");
    async function copyHashes() {
        const lines: string[] = [];
        for (const ref of content.blobReferences) {
            const resp = await client.vaultFileInfo(ref.canisterId, ref.blobId);
            if (resp.kind === "success") {
                lines.push(
                    `file ${ref.blobId}: sha256 ${resp.hash} (${resp.mimeType}, ${resp.size} bytes)`,
                );
            }
        }
        for (const m of mediaMatches) {
            if (m.hash !== undefined) {
                lines.push(`file ${m.blobId}: ${m.provider} hash ${m.hash}`);
            }
        }
        const ok = lines.length > 0 && (await copyToClipboard(lines.join("\n")));
        hashCopyState = ok ? "copied" : "failed";
        window.setTimeout(() => (hashCopyState = "idle"), 2000);
    }

    // The manual-filing checklist opens in its own tab so the moderator can keep the
    // report card open while working through it
    let checklistUrl = $derived.by(() => {
        const params = new URLSearchParams();
        if (content.reportIndex !== undefined) {
            params.set("report", content.reportIndex.toString());
        }
        params.set("origin", mediaMatches.length > 0 ? "hash" : "manual");
        if (content.authorityReport?.kind === "due" && content.authorityReport.urgent) {
            params.set("urgent", "true");
        }
        if (content.authorityReport?.kind === "contingency_required") {
            params.set("state", "contingency");
        } else if (content.authorityReport?.kind === "validation_failed") {
            params.set("state", "validation");
        } else if (content.authorityReport?.kind === "attempting") {
            params.set("state", "reconcile");
        }
        return `/csea-reporting?${params}`;
    });
    let canResolve = $derived(
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            !content.isBlockedAttempt &&
            (content.status.kind === "pending" || content.status.kind === "contested"),
    );

    function resolve(verdict: ModerationVerdict) {
        if (content.reportIndex === undefined || busy || resolved) return;
        busy = true;
        failed = false;
        failureReason = undefined;
        client
            .resolveModerationReport(
                content.reportIndex,
                verdict,
                verdict === "upheld_as_csam" ? urgent : undefined,
            )
            .then((result) => {
                busy = false;
                resolved = result.kind === "success";
                failed = result.kind !== "success";
                failureReason = result.kind === "error" ? result.message : undefined;
            });
    }
</script>

<Column padding={["sm", "sm", "lg", "sm"]} gap="md">
    <Column>
        <Row gap="sm">
            {#if csam}
                <Subtitle width="hug" colour="error">
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
            <Body colour="error" fontWeight="bold">
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
                <Body fontWeight="bold" colour={authorityReport.urgent ? "error" : "textSecondary"}>
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
                        <Button secondary disabled={hashCopyState !== "idle"} onClick={copyHashes}>
                            <Translatable
                                resourceKey={i18nKey(
                                    hashCopyState === "idle"
                                        ? "moderationReport.copyHashes"
                                        : hashCopyState === "copied"
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
                <Body fontWeight="bold" colour={attemptIsStale ? "error" : "textSecondary"}>
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
                    <a class="checklist-link" href={checklistUrl} target="_blank" rel="noreferrer">
                        <Translatable resourceKey={i18nKey("moderationReport.filingChecklist")} />
                    </a>
                {/if}
            {:else if authorityReport.kind === "contingency_required"}
                <Body fontWeight="bold" colour="error">
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
                <Body fontWeight="bold" colour="error">
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
        {#if reviewerRequired}
            <Body colour="error" fontWeight="bold">
                <Translatable resourceKey={i18nKey("moderationReport.reviewerRequired")} />
            </Body>
        {/if}
        {#if mediaUnavailable}
            <Body colour="error">
                <Translatable resourceKey={i18nKey("moderationReport.mediaUnavailable")} />
            </Body>
        {/if}
        {#if needsMediaReview && mediaFetchFailed}
            <Body colour="error">
                <Translatable resourceKey={i18nKey("moderationReport.mediaFetchFailed")} />
            </Body>
        {/if}
        {#if !needsMediaReview && !reviewerRequired}
            <Row gap="sm">
                <Switch bind:checked={urgent}>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("moderationReport.urgent")} />
                    </Body>
                </Switch>
            </Row>
            <Row gap="sm" padding={["zero", "zero", "md", "zero"]}>
                <Button
                    disabled={busy || resolved}
                    loading={busy}
                    onClick={() => resolve("upheld")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
                </Button>
                <Button
                    danger
                    disabled={busy || resolved}
                    loading={busy}
                    onClick={() => resolve("upheld_as_csam")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
                </Button>
                <Button
                    secondary
                    disabled={busy || resolved}
                    loading={busy}
                    onClick={() => resolve("dismissed")}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
                </Button>
            </Row>
        {/if}
        {#if failed}
            <Body colour="error" fontWeight="bold">
                {#if failureReason !== undefined}
                    {failureReason}
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
        urgent={authorityReport.kind === "due" && authorityReport.urgent}
        onFiled={(ref) => {
            filedReference = ref;
            showFiling = false;
        }}
        onFilingStarted={() => (filingStarted = true)}
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
        onResult={onReviewResult}
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
        border-left: var(--sp-xs) solid var(--error);
        font-style: italic;
        white-space: pre-wrap;
    }
</style>
