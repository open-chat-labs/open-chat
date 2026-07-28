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
    import { i18nKey } from "../../i18n/i18n";
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
    // without looking is exactly what this system exists to prevent
    let mediaReviewed = $state(false);
    let reviewerRequired = $state(false);
    let mediaUnavailable = $state(false);

    function onReviewResult(outcome: "viewed" | "not_authorized" | "error") {
        if (outcome === "viewed") {
            mediaReviewed = true;
        } else if (outcome === "not_authorized") {
            reviewerRequired = true;
        } else {
            mediaUnavailable = true;
            mediaReviewed = true;
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
    let csam = $derived((content.flaggedCategories & 2) !== 0);
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
    // No vault viewer on mobile: verdicts on quarantined-media reports require reviewing the
    // media first, so they can only be resolved on desktop
    let needsMediaReview = $derived(content.blobReferences.length > 0 && !mediaReviewed);
    let canResolve = $derived(
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            (content.status.kind === "pending" || content.status.kind === "contested"),
    );

    function resolve(verdict: ModerationVerdict) {
        if (content.reportIndex === undefined || busy || resolved) return;
        busy = true;
        failed = false;
        client
            .resolveModerationReport(
                content.reportIndex,
                verdict,
                verdict === "upheld_as_csam" ? urgent : undefined,
            )
            .then((success) => {
                busy = false;
                resolved = success;
                failed = !success;
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
                {#if $platformOperatorStore && content.reportIndex !== undefined}
                    <Row gap="sm">
                        <Button secondary onClick={() => (showFiling = true)}>
                            <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                        </Button>
                    </Row>
                {/if}
            {:else}
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
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </Body>
        {/if}
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
