<!-- A row in a details card that only says something (Member since, Created by, History): the label,
     and the value at the end, as the You tab's Member since. A settings-row, so the card divides it. -->
<script lang="ts">
    type Props = { label: string; value: string; mono?: boolean };

    let { label, value, mono = false }: Props = $props();
</script>

<div class="settings-row fact">
    <span class="label">{label}</span>
    <span class="value" class:mono>{value}</span>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .fact {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 8px 16px;
        box-sizing: border-box;
    }

    .label {
        flex: none;
        font: var(--weight-medium) text-size(14px) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    .value {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        text-align: end;
        overflow-wrap: anywhere;

        &.mono {
            font-family: var(--font-mono);
        }
    }
</style>
