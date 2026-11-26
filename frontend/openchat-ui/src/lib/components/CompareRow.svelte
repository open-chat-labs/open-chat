<!-- A setting's current value beside the field for the value proposed, for changes that need a second person to
     confirm (SettingsCard's `dual`): the current one read only, in mono, on the left; the field (children) on the
     right. When the card is narrow they stack, the current value captioned "Current". -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../i18n';

  interface Props {
    /** Literal text: the value now; blank shows `empty`. */
    current: string;
    /** Resource key (or literal text): what a blank current value says ("Not set"). */
    empty?: string;
    /** Resource key (or literal text): the current value's accessible name ("Current API key"). */
    label?: string;
    /** The field for the proposed value. */
    children?: Snippet;
  }

  let { current, empty = 'ui.compareRow.notSet', label = '', children }: Props = $props();
  const t = useT();
</script>

<div class="compare-row">
  <div class="current" class:none={current.trim() === ''} aria-label={label ? `${t(label)}: ${current || t(empty)}` : undefined}>
    <span class="caption">{t('ui.settingsCard.current')}</span>
    <span class="value">{current.trim() === '' ? t(empty) : current}</span>
  </div>
  <div class="proposed">{@render children?.()}</div>
</div>

<style lang="scss">
  .compare-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-14);
    align-items: start;
  }

  .current {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-4);
    min-height: var(--control-xl);
    box-sizing: border-box;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .caption {
    display: none;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .value {
    font: var(--weight-medium) var(--text-md) / 1.4 var(--font-mono);
    color: var(--ink-2);
    overflow-wrap: anywhere;

    .none & {
      font-family: var(--font-sans);
      color: var(--ink-4);
    }
  }

  .proposed {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  @container (max-width: 520px) {
    .compare-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .caption {
      display: block;
    }
  }
</style>
