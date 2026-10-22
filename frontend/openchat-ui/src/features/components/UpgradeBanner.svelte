<!-- Inline upsell: gem icon, a line about the Diamond-only feature, and an Upgrade button. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  interface Props {
    /** Resource key (or literal text). */
    text: string;
    /** Resource key (or literal text). */
    actionLabel?: string;
    onUpgrade?: () => void;
  }

  let { text, actionLabel = 'ui.upgradeBanner.upgrade', onUpgrade }: Props = $props();
  const t = useT();
</script>

<div class="banner">
  <span class="gem"></span>
  <span class="text">{t(text)}</span>
  <span class="upgrade" onclick={onUpgrade} role="button" tabindex="0">{t(actionLabel)}</span>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-10) var(--space-10) var(--space-10) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--accent) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 28%, transparent);
  }

  .gem {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--accent);
    mask: var(--icon-gem) center/contain no-repeat;
  }

  .text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .upgrade {
    flex: none;
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .upgrade:hover {
    filter: brightness(1.08);
  }
</style>
