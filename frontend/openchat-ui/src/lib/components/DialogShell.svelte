<!-- Modal frame: blurred backdrop (click closes), card with title + close, body from children.
     height "auto" sizes to content; otherwise a fixed/min() height so lists can scroll inside.
     Focus moves into the dialog on open and back to the opener on close; Tab stays inside;
     Esc closes only the top-most dialog when several are stacked (e.g. ChatPicker over Invite). -->
<script lang="ts" module>
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  // shared with hand-built dialogs elsewhere, hence a window global
  const stack = (): object[] => ((window as any).__ocDialogs ??= []);
</script>

<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    title: string;
    /** Max width, px. */
    width?: number;
    height?: string;
    /** No body padding (lists that run edge to edge). */
    flush?: boolean;
    z?: number;
    onClose?: () => void;
    children?: Snippet;
  }

  let { title, width = 440, height = 'min(560px,100%)', flush = false, z = 80, onClose, children }: Props = $props();

  let box: HTMLDivElement;

  onMount(() => {
    const self = {};
    const returnTo = document.activeElement as HTMLElement | null;
    stack().push(self);

    const key = (e: KeyboardEvent) => {
      const s = stack();
      if (s[s.length - 1] !== self) return;
      if (e.key === 'Escape') {
        if (onClose) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const els = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) {
        e.preventDefault();
        box.focus();
        return;
      }
      const first = els[0], last = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !box.contains(a))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (a === last || !box.contains(a))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', key);

    // first field if there is one, else the dialog itself (so the close button isn't the default target)
    const focusTimer = setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      const field = box.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]),textarea:not([disabled])');
      (field ?? box).focus({ preventScroll: true });
    }, 60);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', key);
      const s = stack(), i = s.indexOf(self);
      if (i >= 0) s.splice(i, 1);
      if (returnTo?.isConnected && typeof returnTo.focus === 'function') setTimeout(() => returnTo.focus({ preventScroll: true }), 0);
    };
  });
</script>

<div class="layer" style:z-index={z}>
  <div class="scrim" onclick={onClose} aria-hidden="true"></div>
  <div
    class="dialog"
    bind:this={box}
    style:max-width="{width}px"
    style:height
    data-oc-managed=""
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div class="header">
      <span class="title">{title}</span>
      <div class="close"><IconButton label="Close" variant="ghost" icon="close" onClick={onClose}></IconButton></div>
    </div>
    <div class="body" class:flush>{@render children?.()}</div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl, 22px);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.55);
    outline: none;
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: var(--header-h, 66px);
    box-sizing: border-box;
    padding: 0 var(--space-12) 0 var(--space-22, 22px);
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close {
    flex: none;
    display: flex;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    padding: var(--space-16);
  }

  .body.flush {
    padding: 0;
  }
</style>
