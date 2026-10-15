<!-- Status / value chip. sm (18px, sans, for row statuses like Pending) or md (22px, mono, for numbers like timers and % change). -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
    size?: 'sm' | 'md';
    dot?: boolean;
  }

  let { label, tone = 'neutral', size = 'sm', dot = false }: Props = $props();
  const t = useT();
</script>

<span class="pill {tone} {size}">
  {#if dot}<span class="dot"></span>{/if}<span class="label">{t(label)}</span>
</span>

<style>
  .pill {
    flex: none;
    width: max-content;
    min-width: max-content;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 18px;
    padding: 0 7px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    font: var(--weight-semibold) 11px/1 var(--font-sans);
    white-space: nowrap;
  }

  .md {
    height: 22px;
    padding: 0 8px;
    font: 600 12px/1 var(--font-mono);
  }

  .neutral {
    background: var(--overlay-2, rgba(255, 255, 255, 0.06));
    color: var(--ink-2, #c9c9d4);
  }

  .success {
    background: rgba(46, 230, 168, 0.12);
    color: var(--status-online, #2ee6a8);
  }

  .warning {
    background: rgba(255, 176, 61, 0.12);
    color: var(--status-gold, #ffb03d);
  }

  .danger {
    background: rgba(245, 73, 61, 0.12);
    color: var(--status-danger, #f5493d);
  }

  .accent {
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    color: var(--accent-bright, #ff8298);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: currentColor;
  }

  .label {
    flex: none;
  }
</style>
