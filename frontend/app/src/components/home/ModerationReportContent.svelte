<script lang="ts">
    import {
        allUsersStore,
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
    let moderatorId = $derived(
        content.status.kind !== "pending" ? content.status.moderator : undefined,
    );
    let moderator = $derived(moderatorId ? $allUsersStore.get(moderatorId) : undefined);
    let sender = $derived($allUsersStore.get(content.sender)?.username ?? content.sender);
    let reporters = $derived(content.reporters.map((r) => $allUsersStore.get(r)?.username ?? r));

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
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            content.status.kind === "pending",
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
            <span class="csam"
                ><Translatable resourceKey={i18nKey("moderationReport.csam")} /></span>
        {/if}
        <Translatable resourceKey={i18nKey("moderationReport.title")} />
    </div>

    <div class="row link">
        <a href={url}><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a>
    </div>
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
            <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
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
                    moderator: moderator?.username,
                })} />
        </div>
    {:else if content.status.kind === "dismissed"}
        <div class="row resolved">
            <Translatable
                resourceKey={i18nKey("moderationReport.dismissed", {
                    moderator: moderator?.username,
                })} />
        </div>
    {:else if canResolve}
        <div class="actions">
            <Button loading={busy} disabled={busy} onClick={() => resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </Button>
            <Button loading={busy} danger disabled={busy} onClick={() => resolve("upheld_as_csam")}>
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </Button>
            <Button loading={busy} secondary disabled={busy} onClick={() => resolve("dismissed")}>
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
