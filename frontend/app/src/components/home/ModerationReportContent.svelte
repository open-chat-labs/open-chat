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
    // A verdict on a quarantined-media report requires the media to have been reviewed via
    // the vault first: deciding without looking is exactly what this system exists to prevent
    let mediaReviewed = $state(false);
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
                        Message link unavailable for CSAM reports
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
                            <BodySmall>quarantined media attachment</BodySmall>
                            <BodySmall colour="textSecondary"
                                >Opens in the vault viewer. Access is logged.</BodySmall
                            >
                        </Column>
                    {:else}
                        <Column>
                            <BodySmall>media attachment</BodySmall>
                            <BodySmall colour="textSecondary"
                                >Not shown until you open review.</BodySmall
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
                <Body>Dismissed</Body>
                <BodySmall colour="textSecondary"
                    >Resolved by {moderator} - any sanction reversed</BodySmall
                >
            </Column>
        {:else if content.status.kind === "upheld"}
            <Upheld color="var(--success)" size="1.6rem" />
            <Column>
                <Body>Upheld</Body>
                <BodySmall colour="textSecondary">Resolved by {moderator}</BodySmall>
            </Column>
        {:else if content.status.kind === "upheld_as_csam"}
            <Upheld color="var(--error)" size="1.6rem" />
            <Column>
                <Body>Upheld as CSAM</Body>
                <BodySmall colour="textSecondary">
                    {#if content.autoSanctioned}
                        Resolved by {moderator} - the auto-sanction stands
                    {:else}
                        Resolved by {moderator}
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
                    <Body>Imminent threat to a child</Body>
                    <BodySmall colour="textSecondary"
                        >Escalates urgently. Only applies to "Uphold as CSAM"</BodySmall
                    >
                </Column>
            </Checkbox>
        </Row>
    </Column>
{/snippet}

<Column gap="md" padding={["lg", "zero"]}>
    {@const status = content.status.kind}
    <!-- report -->
    {@render reportCard()}
    {@render statusLine()}

    {#if status === "upheld" || status === "upheld_as_csam" || status === "dismissed"}
        {@render resolution()}
    {/if}

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

    {#if canResolve && !needsMediaReview}
        {@render actions()}
    {/if}

    {#if failed}
        <Body colour="error">
            <Translatable resourceKey={i18nKey("moderationReport.failed")} />
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
        onReviewed={() => (mediaReviewed = true)}
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
