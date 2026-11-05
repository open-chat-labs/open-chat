<!-- Settings row for a value to copy (a bot's connection details, a user ID): a small mono label over the value in
     mono, and a copy button that turns into a green tick for 1.6s once it's on the clipboard. The host shows the
     toast ("IC host URL copied") from onCopy. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { useT } from '../lib/i18n';
  import { copyText } from '../lib/clipboard';

  const COPIED_MS = 1600;

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** What's shown and copied. */
    value: string;
    /** Keep the value on one line (it wraps anywhere otherwise: keys, URLs). */
    nowrap?: boolean;
    /** The value is on the clipboard. */
    onCopy?: () => void;
  }

  let { label, value, nowrap = false, onCopy }: Props = $props();
  const t = useT();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  async function copy() {
    if (!(await copyText(value))) return;
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), COPIED_MS);
    onCopy?.();
  }
</script>

<div class="settings-row copy-row">
  <span class="text">
    <span class="label">{t(label)}</span>
    <span class="value" class:nowrap>{value}</span>
  </span>
  <button type="button" class="copy" class:copied aria-label={t(copied ? 'ui.common.copied' : 'ui.native.settings.copy', { label: t(label) })} onclick={copy}>
    <span class="copy-icon"></span>
  </button>
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .copy-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 10px 4px 10px 16px;
    box-sizing: border-box;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.09em;
    color: var(--ink-4);
  }

  .value {
    font: var(--weight-medium) text-size(13px) / 1.4 var(--font-mono);
    color: var(--ink);
    overflow-wrap: anywhere;

    &.nowrap {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .copy {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    @include flex-center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-circle);
    background: none;
    color: var(--ink-3);
    cursor: pointer;

    &.copied {
      color: var(--status-online);
    }
  }

  .copy-icon {
    @include icon(copy, 18px);

    .copied & {
      mask: var(--icon-check) center/contain no-repeat;
    }
  }
</style>
