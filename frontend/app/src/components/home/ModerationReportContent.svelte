<script lang="ts">
    import {
        allUsersStore,
        MODERATION_CATEGORY_NAMES,
        platformModeratorStore,
        routeForMessage,
        type ModerationReportContent,
        type ModerationVerdict,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/components_shared/Markdown.svelte";
    import { Body, Column, Row, Title } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Translatable from "../Translatable.svelte";
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
    let canResolve = $derived(
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            (content.status.kind === "pending" || content.status.kind === "contested"),
    );
    let needsMediaReview = $derived(content.blobReferences.length > 0 && !mediaReviewed);

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

<Column gap="md" padding={["lg", "md"]}>
    <Row gap="md">
        {#if csam}
            <span class="csam"
                ><Translatable resourceKey={i18nKey("moderationReport.csam")} /></span>
        {/if}
        <Title>
            <Translatable resourceKey={i18nKey("moderationReport.title")} />
        </Title>
    </Row>

    {#if csam || content.status.kind === "upheld_as_csam"}
        <!-- Alleged or confirmed CSAM must never be viewed in place: the vault viewer is the
                 only sanctioned route -->
        <Body>
            <Translatable resourceKey={i18nKey("moderationReport.vaultOnly")} />
        </Body>
    {:else if url !== undefined}
        <Body>
            <a class="link" href={url}
                ><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a>
        </Body>
    {:else}
        <Body>
            <Translatable resourceKey={i18nKey("moderationReport.privateChat")} />
        </Body>
    {/if}
    <Body>
        <Translatable resourceKey={i18nKey("moderationReport.sender")} />: {sender}
    </Body>
    <Body>
        {#if reporters.length === 0}
            <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
        {:else}
            <Translatable resourceKey={i18nKey("moderationReport.reporters")} />: {reporters.join(
                ", ",
            )}
        {/if}
    </Body>
    {#if categories !== ""}
        <Body>
            <Translatable resourceKey={i18nKey("moderationReport.categories")} />: {categories}
        </Body>
    {/if}
    {#if content.flaggedCategories === 0 && content.status.kind === "pending"}
        <Body>
            <Translatable
                resourceKey={i18nKey(
                    content.classificationFailed
                        ? "moderationReport.classifierFailed"
                        : "moderationReport.classifierClean",
                )} />
        </Body>
    {/if}
    {#if content.status.kind === "contested"}
        <Body fontWeight="bold" colour="error">
            <Translatable resourceKey={i18nKey("moderationReport.contested")} />
        </Body>
    {/if}
    {#if content.autoSanctioned}
        <Body>
            {#if content.status.kind === "pending" || content.status.kind === "contested"}
                <Translatable resourceKey={i18nKey("moderationReport.sanctionPending")} />
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
            {/if}
        </Body>
    {/if}

    {#if content.contentExcerpt !== undefined}
        <Row padding={["lg", "zero"]}>
            <blockquote class="excerpt">
                <Markdown text={content.contentExcerpt} />
            </blockquote>
        </Row>
    {/if}

    {#if content.status.kind === "upheld" || content.status.kind === "upheld_as_csam"}
        <Body fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.upheld", {
                    moderator,
                })} />
        </Body>
    {:else if content.status.kind === "dismissed"}
        <Body fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.dismissed", {
                    moderator,
                })} />
        </Body>
    {:else if canResolve}
        {#if content.blobReferences.length > 0}
            <Button onClick={() => (showViewer = true)}>
                <Translatable resourceKey={i18nKey("moderationReport.reviewMedia")} />
            </Button>
        {/if}
        {#if !needsMediaReview}
            <Row gap="sm">
                <Button
                    loading={busy}
                    disabled={busy || resolved}
                    onClick={() => resolve("upheld")}>
                    <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
                </Button>
                <Column>
                    <Button
                        loading={busy}
                        danger
                        disabled={busy || resolved}
                        onClick={() => resolve("upheld_as_csam")}>
                        <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
                    </Button>
                    <Checkbox
                        id={`urgent-${content.messageId}`}
                        small
                        label={i18nKey("moderationReport.urgent")}
                        checked={urgent}
                        onChange={() => (urgent = !urgent)} />
                </Column>
                <Button
                    loading={busy}
                    secondary
                    disabled={busy || resolved}
                    onClick={() => resolve("dismissed")}>
                    <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
                </Button>
            </Row>
        {/if}
        {#if failed}
            <Body colour="error">
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </Body>
        {/if}
    {/if}
</Column>

{#if showViewer}
    <VaultMediaViewer
        blobReferences={content.blobReferences}
        quarantined={content.autoSanctioned}
        onReviewed={() => (mediaReviewed = true)}
        onClose={() => (showViewer = false)} />
{/if}

<style lang="scss">
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
</style>
