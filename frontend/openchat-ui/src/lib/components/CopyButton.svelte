<!-- Copy control: writes value to the clipboard and shows a check (and "Copied") for 1.6s, only when the write succeeded.
     variant: ghost (icon, hover fill) | soft (icon on a tinted square) | outline (icon, hairline ring) | filled (icon on accent) | text (icon + "Copy" pill).
     bind:copied lets the owner show its own hint; copy() lets another element (the value itself) trigger the same copy. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy } from 'svelte';
  import { copyText } from '../clipboard';

  interface Props {
    value: string;
    /** Resource key (or literal text) for the tooltip / accessible name (and the text variant's label). */
    label?: string;
    variant?: 'ghost' | 'soft' | 'outline' | 'filled' | 'text';
    /** sm 26px · md 34px · lg 40px (icon variants). */
    size?: 'sm' | 'md' | 'lg';
    /** True while the check is showing. */
    copied?: boolean;
    onCopy?: () => void;
  }

  let { value, label = 'ui.common.copy', variant = 'ghost', size = 'sm', copied = $bindable(false), onCopy }: Props = $props();
  const t = useT();

  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const tip = $derived(t(copied ? 'ui.common.copied' : label));

  export async function copy() {
    if (!(await copyText(value))) return;
    onCopy?.();
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1600);
  }

  function press(e: Event) {
    e.stopPropagation();
    copy();
  }
</script>

{#if variant === 'text'}
  <span class="copy text" class:done={copied} onclick={press} role="button" tabindex="0" aria-label={tip}><span class="icon"></span>{t(copied ? 'ui.common.copied' : 'ui.common.copy')}</span>
{:else}
  <span class="copy {size} {variant}" class:done={copied} onclick={press} role="button" tabindex="0" title={tip} aria-label={tip}><span class="icon"></span></span>
{/if}

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
    user-select: none;
  }

  .copy:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-copy) center/contain no-repeat;
  }

  .md {
    width: 34px;
    height: 34px;
  }

  .lg {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }

  .md .icon,
  .lg .icon {
    width: 16px;
    height: 16px;
  }

  .outline {
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .outline .icon {
    background: var(--ink-2, #b9b9c6);
  }

  .soft {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .soft:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.12));
  }

  .soft .icon {
    background: var(--ink, #ececf1);
  }

  .filled {
    background: var(--accent, #ff5672);
  }

  .filled:hover {
    background: var(--accent, #ff5672);
    filter: brightness(1.08);
  }

  .filled .icon {
    background: var(--on-accent, #2e0512);
  }

  .soft.done,
  .filled.done {
    background: rgba(46, 230, 168, 0.14);
    filter: none;
  }

  .text {
    width: auto;
    height: 32px;
    gap: 7px;
    padding: 0 12px;
    border-radius: var(--radius-sm, 8px);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
  }

  .text .icon {
    width: 14px;
    height: 14px;
    background: var(--ink-2, #b9b9c6);
  }

  .done .icon {
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }
</style>
