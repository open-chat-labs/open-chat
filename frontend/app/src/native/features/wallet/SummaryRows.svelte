<!-- A flow's summary card (the prototype's fee and total, a receipt's, a quote's): label and value
     rows over one panel, a hairline between them. -->
<script lang="ts">
    export type SummaryRow = { label: string; value: string; warn?: boolean };

    let { rows }: { rows: SummaryRow[] } = $props();
</script>

<div class="rows">
    {#each rows as row, i (i)}
        <div class="row">
            <span class="label">{row.label}</span>
            <span class="value" class:warn={row.warn}>{row.value}</span>
        </div>
    {/each}
</div>

<style lang="scss">
    .rows {
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--overlay-1);
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 48px;
        padding: 0 var(--space-16);

        & + & {
            box-shadow: inset 0 1px 0 var(--line-1);
        }
    }

    .label {
        flex: 1;
        font: var(--weight-medium) text-size(14px) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    .value {
        min-width: 0;
        overflow-wrap: anywhere;
        text-align: end;
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-mono);
        color: var(--ink);

        &.warn {
            color: var(--status-warning);
        }
    }
</style>
