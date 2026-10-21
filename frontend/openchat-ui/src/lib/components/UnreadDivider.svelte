<!-- Divider in a message list: tone "accent" is the unread marker (a labelled rule), "neutral" a date pill. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    /** Resource key (or literal text); defaults to "Today" (neutral) or "Unread messages" (accent). */
    label?: string;
    tone?: 'accent' | 'neutral';
  }

  let { label, tone = 'accent' }: Props = $props();
  const t = useT();
</script>

<div class="divider">
  {#if tone === 'neutral'}
    <span class="pill">{t(label ?? 'ui.unreadDivider.today')}</span>
  {:else}
    <span class="rule"></span>
    <span class="label">{t(label ?? 'ui.unreadDivider.unread')}</span>
    <span class="rule"></span>
  {/if}
</div>

<style>
  .divider {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-12);
  }

  .pill {
    flex: none;
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--field);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .rule {
    flex: 1;
    height: 1px;
    background: var(--accent-dim);
  }

  .label {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--accent);
  }
</style>
