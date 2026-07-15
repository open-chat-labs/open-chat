<script lang="ts">
    import {
        platformModeratorStore,
        routeForMessage,
        type ModerationReportContent,
        type ModerationVerdict,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    const CATEGORY_NAMES: [number, string][] = [
        [1, "sexual"],
        [2, "sexual/minors"],
        [4, "violence"],
        [8, "violence/graphic"],
        [16, "harassment"],
        [32, "harassment/threatening"],
        [64, "self-harm"],
        [128, "illicit"],
    ];

    interface Props {
        content: ModerationReportContent;
    }

    let { content }: Props = $props();

    let busy = $state(false);
    let failed = $state(false);

    let csam = $derived((content.flaggedCategories & 2) !== 0);
    let categories = $derived(
        CATEGORY_NAMES.filter(([bit, _name]) => (content.flaggedCategories & bit) !== 0)
            .map(([_bit, name]) => name)
            .join(", "),
    );
    let url = $derived(
        routeForMessage(
            content.chatId.kind === "channel" ? "community" : "chats",
            {
                chatId: content.chatId,
                threadRootMessageIndex: content.threadRootMessageIndex,
            },
            content.messageIndex,
        ),
    );
    let canResolve = $derived(
        $platformModeratorStore && content.reportIndex !== undefined && content.status.kind === "pending",
    );

    function resolve(verdict: ModerationVerdict) {
        if (content.reportIndex === undefined || busy) return;
        busy = true;
        failed = false;
        client.resolveModerationReport(content.reportIndex, verdict).then((success) => {
            busy = false;
            failed = !success;
        });
    }
</script>

<div class="report">
    <div class="header">
        {#if csam}
            <span class="csam"><Translatable resourceKey={i18nKey("moderationReport.csam")} /></span>
        {/if}
        <Translatable resourceKey={i18nKey("moderationReport.title")} />
    </div>

    <div class="row">
        <a href={url}><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a>
    </div>
    <div class="row">
        <Translatable resourceKey={i18nKey("moderationReport.sender")} />: {content.sender}
    </div>
    <div class="row">
        {#if content.reporters.length === 0}
            <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
        {:else}
            <Translatable resourceKey={i18nKey("moderationReport.reporters")} />: {content.reporters.join(", ")}
        {/if}
    </div>
    {#if categories !== ""}
        <div class="row">
            <Translatable resourceKey={i18nKey("moderationReport.categories")} />: {categories}
        </div>
    {/if}
    {#if content.autoSanctioned}
        <div class="row">
            <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
        </div>
    {/if}
    {#if content.contentExcerpt !== undefined}
        <blockquote class="excerpt">{content.contentExcerpt}</blockquote>
    {/if}

    {#if content.status.kind === "upheld" || content.status.kind === "upheld_as_csam"}
        <div class="row resolved">
            <Translatable resourceKey={i18nKey("moderationReport.upheld", { moderator: content.status.moderator })} />
        </div>
    {:else if content.status.kind === "dismissed"}
        <div class="row resolved">
            <Translatable resourceKey={i18nKey("moderationReport.dismissed", { moderator: content.status.moderator })} />
        </div>
    {:else if canResolve}
        <div class="actions">
            <button disabled={busy} onclick={() => resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </button>
            <button class="danger" disabled={busy} onclick={() => resolve("upheld_as_csam")}>
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </button>
            <button disabled={busy} onclick={() => resolve("dismissed")}>
                <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
            </button>
        </div>
        {#if failed}
            <div class="row failed">
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
    .report {
        display: flex;
        flex-direction: column;
        gap: toRem(6);
        padding: toRem(8);
        font-size: toRem(14);
    }
    .header {
        font-weight: 700;
        display: flex;
        gap: toRem(8);
        align-items: center;
    }
    .csam {
        background-color: var(--error);
        color: #ffffff;
        border-radius: toRem(4);
        padding: toRem(1) toRem(6);
        font-size: toRem(12);
        font-weight: 700;
    }
    .row {
        color: var(--txt-light, inherit);
        word-break: break-all;
    }
    .excerpt {
        margin: 0;
        padding-left: toRem(8);
        border-left: 2px solid var(--error);
        font-style: italic;
        white-space: pre-wrap;
    }
    .resolved {
        font-weight: 600;
    }
    .failed {
        color: var(--error);
    }
    .actions {
        display: flex;
        gap: toRem(8);
        margin-top: toRem(4);

        button {
            cursor: pointer;
            padding: toRem(4) toRem(12);
            border-radius: toRem(6);
            border: 1px solid var(--bd, #999999);
            background: none;
            color: inherit;

            &.danger {
                border-color: var(--error);
                color: var(--error);
            }

            &:disabled {
                opacity: 0.5;
                cursor: default;
            }
        }
    }
</style>
