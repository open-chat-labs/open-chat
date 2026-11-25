<!-- The older reported message card in the moderation channel (`reported_message_content`, L6c),
     drawn in the conversation through MessageGroup's `customContent`: the old card ported plainly
     (logic/moderation's reportedMessage). One of the message's reports at a time (who, when, why,
     their notes), a numbered button for each, and how many of all its reports these are.
     TODO(design): the design has no reported message card; the old card's layout and words. -->
<script lang="ts">
    import { allUsersStore, type OpenChat, type ReportedMessageContent } from "@client";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { reportedMessageText, reportHasNotes } from "@src/logic/moderation/reportedMessage";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        content: ReportedMessageContent;
    }

    let { content }: Props = $props();

    const client = getContext<OpenChat>("client");

    let index = $state(0);
    const report = $derived(content.reports[index]);
    const message = $derived(
        report === undefined
            ? undefined
            : reportedMessageText(report, {
                  username: (id) => $allUsersStore.get(id)?.username,
                  datetime: (date) => client.toDatetimeString(date),
                  translate: $_,
              }),
    );
</script>

<section class="reported">
    {#if report !== undefined && message !== undefined}
        <div class="msg"><Markdown text={message} /></div>
        {#if reportHasNotes(report)}
            <ListSectionLabel label={$_("report.notes")} />
            <p class="notes">{report.notes}</p>
        {/if}
    {/if}
    <div class="selectors" role="group">
        {#each content.reports as r, i (i)}
            <button
                class="selector"
                class:selected={report === r}
                aria-pressed={report === r}
                onclick={() => (index = i)}>
                {i + 1}
            </button>
        {/each}
    </div>
    <p class="smallprint">
        {$_("report.showing", {
            values: { count: content.reports.length, total: content.total.toLocaleString() },
        })}
    </p>
</section>

<style lang="scss">
    .reported {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        width: 100%;
        padding: var(--space-12) var(--space-14);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
        font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
        color: var(--ink);
    }

    .notes {
        margin: 0;
        padding: var(--space-8) var(--space-12);
        border-radius: var(--radius-md);
        background: var(--surface-2);
        white-space: pre-wrap;
        color: var(--ink-2);
    }

    .selectors {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-8);
    }

    .selector {
        min-width: 28px;
        height: 28px;
        padding: 0 var(--space-6);
        border: none;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        box-shadow: inset 0 0 0 1px var(--line-2);
        color: var(--ink);
        font: var(--weight-medium) var(--text-xs) / 1 var(--font-sans);
        cursor: pointer;

        &.selected {
            background: var(--accent);
            box-shadow: none;
            color: var(--on-accent);
        }
    }

    .smallprint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--ink-3);
    }
</style>
