<!-- Small marker. variant: count (accent number) | tag (accent label) | neutral | chit (amount + "CHIT"; `short` drops the word)
     | dot (unread dot) | verified (blue check). -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    /** Count / CHIT amount, or a resource key (or literal text) for tag and neutral chips. */
    label?: string;
    variant?: 'count' | 'tag' | 'neutral' | 'chit' | 'dot' | 'verified';
    short?: boolean;
  }

  let { label = '', variant = 'count', short = false }: Props = $props();
  const t = useT();
</script>

<div class="badge">
  {#if variant === 'count'}
    <span class="count">{label}</span>
  {:else if variant === 'tag' || variant === 'neutral'}
    <span class="chip {variant}">{t(label)}</span>
  {:else if variant === 'chit'}
    <span class="chip chit">
      <span>{label}</span>
      {#if !short}
        <span class="unit">CHIT</span>
      {/if}
    </span>
  {:else if variant === 'verified'}
    <span class="verified"></span>
  {:else if variant === 'dot'}
    <span class="dot"></span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .badge {
    display: inline-flex;
    flex: none;
  }

  .count {
    @include flex-center(inline-flex);
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
  }

  .chip {
    @include flex-center(inline-flex);
    height: 22px;
    padding: 0 var(--space-8);
    border-radius: var(--radius-pill);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: 0.02em;
  }

  .tag {
    background: var(--accent-soft);
    color: var(--accent-bright);
  }

  .neutral {
    background: var(--overlay-1);
    color: var(--ink-2);
  }

  .chit {
    justify-content: flex-start;
    gap: var(--space-6);
    background: var(--status-chit-soft);
    color: var(--status-chit);
  }

  .unit {
    opacity: 0.72;
  }

  .verified {
    @include icon(verified, 17px, var(--status-verified));
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    box-shadow: 0 0 0 2.5px var(--card-ring-1);
  }
</style>
