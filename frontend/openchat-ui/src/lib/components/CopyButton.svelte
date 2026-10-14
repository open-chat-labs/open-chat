<!-- Icon-only copy: writes value to the clipboard, shows a check for 1.6s. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy } from 'svelte';

  interface Props {
    value: string;
    /** Resource key (or literal text) for the tooltip / accessible name. */
    label?: string;
    size?: 'sm' | 'md';
    onCopy?: () => void;
  }

  let { value, label = 'ui.common.copy', size = 'sm', onCopy }: Props = $props();
  const t = useT();

  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const tip = $derived(t(done ? 'ui.common.copied' : label));

  function copy(e: Event) {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(value);
    } catch {}
    onCopy?.();
    done = true;
    clearTimeout(timer);
    timer = setTimeout(() => (done = false), 1600);
  }
</script>

<span class="copy {size}" class:done onclick={copy} role="button" tabindex="0" title={tip} aria-label={tip}><span class="icon"></span></span>

<style>
  .copy {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .copy:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .icon {
    width: 13px;
    height: 13px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-copy) center/contain no-repeat;
  }

  .md {
    width: 34px;
    height: 34px;
  }

  .md .icon {
    width: 16px;
    height: 16px;
  }

  .done .icon {
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }
</style>
