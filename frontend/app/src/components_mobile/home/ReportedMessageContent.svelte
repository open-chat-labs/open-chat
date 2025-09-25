<script lang="ts">
    import type { OpenChat, ReportedMessageContent } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import TextArea from "../TextArea.svelte";
    import Markdown from "./Markdown.svelte";

    interface Props {
        content: ReportedMessageContent;
    }

    let { content }: Props = $props();
    const client = getContext<OpenChat>("client");

    let index = $state(0);

    let report = $derived(content.reports[index]);
    let reasons = [
        $_("report.threat"),
        $_("report.child"),
        $_("report.nonConsensual"),
        $_("report.selfHarm"),
        $_("report.violence"),
        $_("report.scam"),
        $_("report.other"),
    ];
    let message = $derived(
        $_("report.messageReport", {
            values: {
                username:
                    $allUsersStore.get(report.reportedBy)?.username ??
                    `unknown user (${report.reportedBy}))`,
                timestamp: client.toDatetimeString(new Date(report.timestamp)),
                reason: reasons[report.reasonCode],
            },
        }),
    );
</script>

<div class="report">
    <p class="msg"><Markdown text={message} /></p>
    {#if report.notes !== undefined && report.notes.length > 0}
        <Legend label={i18nKey("Notes")} />
        <TextArea disabled rows={2} bind:value={report.notes} />
    {/if}
</div>

<div class="report-selectors">
    {#each content.reports as r, i}
        <div onclick={() => (index = i)} class="selector" class:selected={report === r}>
            {i + 1}
        </div>
    {/each}
</div>

<div class="smallprint">
    {$_("report.showing", {
        values: { count: content.reports.length, total: content.total.toLocaleString() },
    })}
</div>

<style lang="scss">
    .report {
        @include font(book, normal, fs-100);
        margin-bottom: $sp4;
    }
    .msg {
        margin-bottom: $sp3;
    }
    .smallprint {
        color: var(--txt-light);
        @include font-size(fs-80);
    }
    .report-selectors {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp3;
    }
    .selector {
        cursor: pointer;
        width: 26px;
        border: 1px solid var(--bd);
        border-radius: 50%;
        text-align: center;

        &.selected {
            background-color: var(--accent);
            text-shadow: 1px 1px 1px var(--accentDarker);
            color: #ffffff;
        }
    }
</style>
