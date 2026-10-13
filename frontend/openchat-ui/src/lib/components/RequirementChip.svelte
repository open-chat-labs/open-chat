<!-- Gate / requirement chip. state: met (green check) | unmet (amber lock) | neutral (no verdict yet, e.g. guest). size sm 22 | md 26. -->
<script lang="ts">
  type State = 'met' | 'unmet' | 'neutral';

  interface Props {
    label: string;
    state?: State;
    /** Shorthand for state: true → met, false → unmet. */
    met?: boolean;
    /** Icon for the neutral state. */
    icon?: string;
    size?: 'sm' | 'md';
  }

  let { label, state, met, icon, size = 'md' }: Props = $props();

  const resolved: State = $derived(state ?? (met === true ? 'met' : met === false ? 'unmet' : 'neutral'));
  const glyph = $derived(resolved === 'met' ? 'check' : resolved === 'unmet' ? 'lock' : icon || 'shield');
  const verdict = $derived(resolved === 'met' ? ' — met' : resolved === 'unmet' ? ' — not met' : '');
</script>

<span class="chip {resolved}" class:sm={size === 'sm'} role="listitem" aria-label={label + verdict}>
  <span class="glyph" style:mask="var(--icon-{glyph}) center/contain no-repeat" aria-hidden="true"></span>{label}
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
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 13%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .unmet {
    background: color-mix(in oklch, var(--status-warning, #ffb03d) 14%, transparent);
    color: var(--status-warning, #ffb03d);
  }

  .neutral {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink-2, #b9b9c6);
  }

  .glyph {
    width: 12px;
    height: 12px;
    background: currentColor;
  }
</style>
