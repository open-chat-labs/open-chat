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
    let moderatorId = $derived(
        content.status.kind !== "pending" ? content.status.moderator : undefined,
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
            content.status.kind === "pending",
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

<div class="report">
    <div class="header">
        {#if csam}
            <span class="csam"
                ><Translatable resourceKey={i18nKey("moderationReport.csam")} /></span>
        {/if}
        <Translatable resourceKey={i18nKey("moderationReport.title")} />
    </div>

    {#if url !== undefined}
        <div class="row link">
            <a href={url}><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a>
        </div>
    {:else}
        <div class="row">
            <Translatable resourceKey={i18nKey("moderationReport.privateChat")} />
        </div>
    {/if}
    <div class="row">
        <Translatable resourceKey={i18nKey("moderationReport.sender")} />: {sender}
    </div>
    <div class="row">
        {#if reporters.length === 0}
            <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
        {:else}
            <Translatable resourceKey={i18nKey("moderationReport.reporters")} />: {reporters.join(
                ", ",
            )}
        {/if}
    </div>
    {#if categories !== ""}
        <div class="row">
            <Translatable resourceKey={i18nKey("moderationReport.categories")} />: {categories}
        </div>
    {/if}
    {#if content.autoSanctioned}
        <div class="row">
            {#if content.status.kind === "pending"}
                <Translatable resourceKey={i18nKey("moderationReport.sanctionPending")} />
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
            {/if}
        </div>
    {/if}

    {#if content.contentExcerpt !== undefined}
        <blockquote class="excerpt">
            <Markdown text={content.contentExcerpt} />
        </blockquote>
    {/if}

    {#if content.status.kind === "upheld" || content.status.kind === "upheld_as_csam"}
        <div class="row resolved">
            <Translatable
                resourceKey={i18nKey("moderationReport.upheld", {
                    moderator,
                })} />
        </div>
    {:else if content.status.kind === "dismissed"}
        <div class="row resolved">
            <Translatable
                resourceKey={i18nKey("moderationReport.dismissed", {
                    moderator,
                })} />
        </div>
    {:else if canResolve}
        {#if content.blobReferences.length > 0}
            <div class="row">
                <Button secondary onClick={() => (showViewer = true)}>
                    <Translatable resourceKey={i18nKey("moderationReport.reviewMedia")} />
                </Button>
            </div>
        {/if}
        <Checkbox
            id={`urgent-${content.messageId}`}
            label={i18nKey("moderationReport.urgent")}
            checked={urgent}
            onChange={() => (urgent = !urgent)} />
        <div class="actions">
            <Button loading={busy} disabled={busy || resolved} onClick={() => resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </Button>
            <Button
                loading={busy}
                danger
                disabled={busy || resolved}
                onClick={() => resolve("upheld_as_csam")}>
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </Button>
            <Button
                loading={busy}
                secondary
                disabled={busy || resolved}
                onClick={() => resolve("dismissed")}>
                <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
            </Button>
        </div>
        {#if failed}
            <div class="row failed">
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </div>
        {/if}
    {/if}
</div>

{#if showViewer}
    <VaultMediaViewer
        blobReferences={content.blobReferences}
        onClose={() => (showViewer = false)} />
{/if}

<style lang="scss">
    .report {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp3;
    }
    .header {
        @include font(bold, normal, fs-120);
        display: flex;
        gap: $sp3;
        align-items: center;
    }
    .csam {
        @include font(bold, normal, fs-100);
        background-color: var(--error);
        color: #ffffff;
        border-radius: toRem(4);
        padding: toRem(1) toRem(6);
    }
    .row {
        color: var(--txt-light, inherit);
        word-break: break-all;

        &.link {
            color: var(--secondary);
        }
    }
    .excerpt {
        margin: 0;
        padding-left: $sp3;
        border-left: $sp1 solid var(--error);
        font-style: italic;
        white-space: pre-wrap;
    }
    .resolved {
        font-weight: bold;
    }
    .failed {
        color: var(--error);
    }
    .actions {
        display: flex;
        gap: $sp3;
        margin-top: $sp2;
    }
</style>
