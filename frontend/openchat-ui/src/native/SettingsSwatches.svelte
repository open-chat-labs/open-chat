<!-- Settings row with colour swatches (Appearance's Accent colour): the label, then 30px circles; the picked one
     gets a 2px ring of its colour, 3px out. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import { rove } from '../lib/behaviours/rove';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** `colour` is any CSS colour the host gives (a swatch shows its own colour, not the theme's). */
    swatches: { id: string; label: string; colour: string }[];
    /** The picked swatch's id. */
    selected: string;
    onSelect: (id: string) => void;
  }

  let { label, swatches, selected, onSelect }: Props = $props();
  const t = useT();

  function keyNav(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    rove(e, '[role="radio"]', 'h')?.click();
  }
</script>

<div class="settings-row swatch-row">
  <span class="label">{t(label)}</span>
  <div class="swatches" role="radiogroup" aria-label={t(label)} tabindex="-1" onkeydown={keyNav}>
    {#each swatches as swatch (swatch.id)}
      {@const on = swatch.id === selected}
      <button type="button" class="swatch" class:on role="radio" aria-checked={on} aria-label={t(swatch.label)} tabindex={on ? 0 : -1} style:--swatch={swatch.colour} onclick={() => onSelect(swatch.id)}></button>
    {/each}
  </div>
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .swatch-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 64px;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .swatches {
    flex: none;
    display: flex;
    gap: 10px;
  }

  .swatch {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-circle);
    background: var(--swatch);
    cursor: pointer;

    &.on {
      box-shadow:
        0 0 0 3px var(--surface-1),
        0 0 0 5px var(--swatch);
    }
  }
</style>
