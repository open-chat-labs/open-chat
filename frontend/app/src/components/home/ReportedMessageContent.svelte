<script lang="ts">
    import type { OpenChat, ReportedMessageContent } from "@client";
    import { allUsersStore } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import TextArea from "../TextArea.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { reportedMessageText } from "@src/logic/moderation/reportedMessage";

    interface Props {
        content: ReportedMessageContent;
    }

    let { content }: Props = $props();
    const client = getContext<OpenChat>("client");

    let index = $state(0);

    let report = $derived(content.reports[index]);
    // The report's line is logic/moderation's (reportedMessage), shared with the other tree's card
    // and the new web UI's
    let message = $derived(
        reportedMessageText(report, {
            username: (id) => $allUsersStore.get(id)?.username,
            datetime: (date) => client.toDatetimeString(date),
            translate: $_,
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
