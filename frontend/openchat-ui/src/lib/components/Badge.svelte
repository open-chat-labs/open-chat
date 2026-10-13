<!-- Small marker. variant: count (accent number) | tag (accent label) | neutral | chit (amount + "CHIT"; `short` drops the word)
     | dot (unread dot) | verified (blue check). -->
<script lang="ts">
  interface Props {
    label?: string;
    variant?: 'count' | 'tag' | 'neutral' | 'chit' | 'dot' | 'verified';
    short?: boolean;
  }

  let { label = '', variant = 'count', short = false }: Props = $props();
</script>

<div class="badge">
  {#if variant === 'count'}
    <span class="count">{label}</span>
  {:else if variant === 'tag' || variant === 'neutral'}
    <span class="chip {variant}">{label}</span>
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

<style>
  .badge {
    display: inline-flex;
    flex: none;
  }

  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    padding: 0 var(--space-8);
    border-radius: var(--radius-pill);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: 0.02em;
  }

  .tag {
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    color: var(--accent-bright, #ff8298);
  }

  .neutral {
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
    color: var(--ink-2, #b9b9c6);
  }

  .chit {
    justify-content: flex-start;
    gap: var(--space-6);
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    color: var(--status-chit, #ff9f45);
  }

  .unit {
    opacity: 0.72;
  }

  .verified {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--status-verified, #3d9bff);
    mask: var(--icon-verified) center/contain no-repeat;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    box-shadow: 0 0 0 2.5px var(--card-ring-1, #0e0e12);
  }
</style>
