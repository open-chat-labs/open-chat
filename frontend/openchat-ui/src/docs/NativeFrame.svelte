<!-- A phone-sized native root for the Native group's demos: data-platform="native" with the docs' mode and accent and
     the picked platform (data-os). Its transform makes it the containing block of the kit's position: fixed layers
     (sheet, menus, toasts), as the app's window is, so they open inside the phone. Safe areas are this browser's (0 on
     a desktop). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    os: 'ios' | 'android';
    mode: string;
    accent: string;
    /** Mono caps label above the phone. */
    label?: string;
    /** The phone's height in px. */
    height?: number;
    children?: Snippet;
  }

  let { os, mode, accent, label = '', height = 320, children }: Props = $props();
</script>

<div class="native-frame">
  {#if label}<div class="label">{label}</div>{/if}
  <div class="phone" data-platform="native" data-os={os} data-mode={mode} data-accent={accent} style:height="{height}px">
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .native-frame { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
  .label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .phone {
    position: relative;
    transform: translateZ(0);
    overflow: hidden;
    width: 100%;
    max-width: 402px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: 28px;
    background: var(--surface-0);
    color: var(--ink);
    font-family: var(--font-sans);
  }
  /* the phone's edge, over what fills it */
  .phone::after { content: ''; position: absolute; inset: 0; z-index: 1000; border-radius: inherit; box-shadow: inset 0 0 0 1px var(--line-2); pointer-events: none; }
</style>
