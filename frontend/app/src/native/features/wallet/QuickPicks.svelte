<!-- The amount's quick picks (the prototype's 25% / 50% / 75% / Max): what each one fills in is the
     flow's (flows.adapter's quickAmount). -->
<script lang="ts">
    import { _ } from "svelte-i18n";
    import { QUICK_PICKS, type QuickPick } from "./flows.adapter";

    type Props = { onPick: (pick: QuickPick) => void; disabled?: boolean };

    let { onPick, disabled = false }: Props = $props();

    const percent = new Intl.NumberFormat(undefined, { style: "percent" });
</script>

<div class="picks">
    {#each QUICK_PICKS as pick (pick)}
        <button type="button" class="pick" {disabled} onclick={() => onPick(pick)}>
            {pick === 100 ? $_("native.walletFlows.max") : percent.format(pick / 100)}
        </button>
    {/each}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .picks {
        align-self: stretch;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-6);
    }

    .pick {
        height: 36px;
        border: 0;
        border-radius: var(--radius-sm);
        background: var(--tint-pill);
        color: var(--ink-2);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }

        &:disabled {
            opacity: 0.5;
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }
</style>
