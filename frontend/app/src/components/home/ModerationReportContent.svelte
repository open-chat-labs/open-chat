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
    import { Body, BodySmall, ColourVars, Column, Row, Subtitle } from "component-lib";
    import { getContext } from "svelte";
    import Upheld from "svelte-material-icons/CheckCircleOutline.svelte";
    import Dismissed from "svelte-material-icons/CloseCircleOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Translatable from "../Translatable.svelte";
    import FileAuthorityReport from "./FileAuthorityReport.svelte";
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
    let authorityReport = $derived(
        filedReference !== undefined
            ? { kind: "filed" as const, portalReference: filedReference }
            : content.authorityReport,
    );
    // A verdict on a media report requires the media to have been reviewed first: deciding
    // without looking is exactly what this system exists to prevent. Two exceptions surface
    // explicitly rather than silently locking the card: the caller not being a designated
    // vault reviewer, and the media being unavailable (in which case the verdict proceeds on
    // the remaining evidence).
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
    // Alleged OR confirmed CSAM: a classifier-clean escalated report upheld as CSAM has no
    // flag bits, but must still never link to the content in place
    let csamish = $derived(csam || content.status.kind === "upheld_as_csam");
    let categories = $derived(
        MODERATION_CATEGORY_NAMES.filter(
            ([bit, _name]) => (content.flaggedCategories & bit) !== 0,
        ).map(([_bit, name]) => name),
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
    let canResolve = $derived(
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            (content.status.kind === "pending" || content.status.kind === "contested"),
    );
    let hasMedia = $derived(content.blobReferences.length > 0);
    let needsMediaReview = $derived(hasMedia && !mediaReviewed);

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

{#snippet reportCard()}
    <Column borderRadius="md" backgroundColor={ColourVars.background1}>
        <Row
            padding="lg"
            backgroundColor={csam ? ColourVars.tertiaryMuted : ColourVars.background0}
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
            <Row backgroundColor={ColourVars.background0} padding="lg" gap="md">
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
            <Column backgroundColor={ColourVars.background0} padding="lg" gap="md">
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
                    backgroundColor={csam ? ColourVars.tertiaryMuted : ColourVars.background0}
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
            <Row padding="lg" backgroundColor={ColourVars.background0}>
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
        <Row gap="sm" wrap padding="lg" borderRadius="md" backgroundColor={ColourVars.background1}>
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
                <Body width="hug" fontWeight="bold" colour="error">
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
            ? ColourVars.tertiaryMuted
            : ColourVars.background1}
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
            <Button loading={busy} disabled={busy || resolved} onClick={() => resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </Button>
            <Button
                loading={busy}
                danger
                disabled={busy || resolved}
                onClick={() => resolve("upheld_as_csam")}
            >
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </Button>
            <Button
                loading={busy}
                secondary
                disabled={busy || resolved}
                onClick={() => resolve("dismissed")}
            >
                <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
            </Button>
        </Row>

        <Row borderRadius="md" padding="lg" backgroundColor={ColourVars.tertiaryMuted}>
            <Checkbox
                id={`urgent-${content.messageId}`}
                small
                label={i18nKey("moderationReport.urgent")}
                checked={urgent}
                onChange={() => (urgent = !urgent)}
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
            backgroundColor={authorityReport.kind === "due"
                ? ColourVars.tertiaryMuted
                : ColourVars.background1}
        >
            {#if authorityReport.kind === "due"}
                <Body
                    width="hug"
                    fontWeight="bold"
                    colour={authorityReport.urgent ? "error" : undefined}
                >
                    <Translatable
                        resourceKey={i18nKey(
                            authorityReport.urgent
                                ? "moderationReport.ncaDueUrgent"
                                : "moderationReport.ncaDue",
                        )}
                    />
                </Body>
                {#if $platformOperatorStore && content.reportIndex !== undefined}
                    <Button tiny onClick={() => (showFiling = true)}>
                        <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                    </Button>
                {/if}
            {:else}
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
        <Row gap="sm" wrap padding="lg" borderRadius="md" backgroundColor={ColourVars.background1}>
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

    {#if canResolve && reviewerRequired}
        <Body colour="error">
            <Translatable resourceKey={i18nKey("moderationReport.reviewerRequired")} />
        </Body>
    {:else if canResolve && needsMediaReview && mediaFetchFailed}
        <Body colour="error">
            <Translatable resourceKey={i18nKey("moderationReport.mediaFetchFailed")} />
        </Body>
    {:else if canResolve && !needsMediaReview}
        {#if mediaUnavailable}
            <Body colour="error">
                <Translatable resourceKey={i18nKey("moderationReport.mediaUnavailable")} />
            </Body>
        {/if}
        {@render actions()}
    {/if}

    {#if failed}
        <Body colour="error">
            {#if failureReason !== undefined}
                {failureReason}
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            {/if}
        </Body>
    {/if}
</Column>

{#if showFiling && content.reportIndex !== undefined && authorityReport?.kind === "due"}
    <FileAuthorityReport
        reportIndex={content.reportIndex}
        urgent={authorityReport.urgent}
        onFiled={(ref) => {
            filedReference = ref;
            showFiling = false;
        }}
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
    .link {
        color: var(--secondary);
    }
</style>
