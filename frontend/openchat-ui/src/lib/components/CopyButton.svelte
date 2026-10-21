<!-- Copy control: writes value to the clipboard and shows a check (and "Copied") for 1.6s, only when the write succeeded.
     variant: ghost (icon, hover fill) | soft (icon on a tinted square) | outline (icon, hairline ring) | filled (icon on accent)
     | text (icon + "Copy" pill) | primary (icon + "Copy" on accent, 40px: a card's main action).
     bind:copied lets the owner show its own hint; copy() lets another element (the value itself) trigger the same copy. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy } from 'svelte';
  import { copyText } from '../clipboard';

  interface Props {
    value: string;
    /** Resource key (or literal text) for the tooltip / accessible name (and the text variant's label). */
    label?: string;
    variant?: 'ghost' | 'soft' | 'outline' | 'filled' | 'text' | 'primary';
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

{#if variant === 'text' || variant === 'primary'}
  <span class="copy text" class:primary={variant === 'primary'} class:done={copied} onclick={press} role="button" tabindex="0" aria-label={tip}><span class="icon"></span>{t(copied ? 'ui.common.copied' : 'ui.common.copy')}</span>
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
    background: var(--overlay-2);
  }

  .icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-3);
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
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .outline .icon {
    background: var(--ink-2);
  }

  .soft {
    background: var(--overlay-2);
  }

  .soft:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.12));
  }

  .soft .icon {
    background: var(--ink);
  }

  .filled {
    background: var(--accent);
  }

  .filled:hover {
    background: var(--accent);
    filter: brightness(1.08);
  }

  .filled .icon {
    background: var(--on-accent);
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
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
  }

  .text .icon {
    width: 14px;
    height: 14px;
    background: var(--ink-2);
  }

  .primary {
    height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    box-shadow: none;
    background: var(--accent);
    font: 600 13px/1 var(--font-sans);
    color: var(--on-accent);
  }

  .primary:hover {
    background: var(--accent);
    filter: brightness(1.08);
  }

  .primary .icon {
    background: currentColor;
  }

  .primary.done {
    background: rgba(46, 230, 168, 0.14);
    filter: none;
    color: var(--status-online);
  }

  .done .icon {
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }
</style>
