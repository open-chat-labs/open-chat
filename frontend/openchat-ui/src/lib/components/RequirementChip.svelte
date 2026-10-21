<!-- Gate / requirement chip. state: met (green check) | unmet (amber lock) | neutral (no verdict yet, e.g. guest). size sm 22 | md 26. -->
<script lang="ts">
  import { useT } from '../i18n';
  type State = 'met' | 'unmet' | 'neutral';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    state?: State;
    /** Shorthand for state: true → met, false → unmet. */
    met?: boolean;
    /** Icon for the neutral state. */
    icon?: string;
    size?: 'sm' | 'md';
  }

  let { label, state, met, icon, size = 'md' }: Props = $props();
  const t = useT();

  const resolved: State = $derived(state ?? (met === true ? 'met' : met === false ? 'unmet' : 'neutral'));
  const glyph = $derived(resolved === 'met' ? 'check' : resolved === 'unmet' ? 'lock' : icon || 'shield');
</script>

<span class="chip {resolved}" class:sm={size === 'sm'} role="listitem" aria-label={t('ui.requirementChip.status', { label: t(label), state: resolved })}>
  <span class="glyph" style:mask="var(--icon-{glyph}) center/contain no-repeat" aria-hidden="true"></span>{t(label)}
</span>

<style>
  .chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 9px;
    border-radius: 999px;
    font: 600 12px/1 var(--font-sans);
    white-space: nowrap;
  }

  .sm {
    height: 22px;
    padding: 0 8px;
    font-size: 11.5px;
  }

  .met {
    background: color-mix(in oklch, var(--status-online) 13%, transparent);
    color: var(--status-online);
  }

  .unmet {
    background: color-mix(in oklch, var(--status-warning) 14%, transparent);
    color: var(--status-warning);
  }

  .neutral {
    background: var(--overlay-2);
    color: var(--ink-2);
  }

  .glyph {
    width: 12px;
    height: 12px;
    background: currentColor;
  }
</style>
