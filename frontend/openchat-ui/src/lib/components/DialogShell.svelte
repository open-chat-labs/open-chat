<!-- Modal frame: blurred backdrop (click closes), card with title + close (and a back arrow with onBack), body from children.
     height "auto" sizes to content; otherwise a fixed/min() height so lists can scroll inside.
     Focus moves into the dialog on open and back to the opener on close; Tab stays inside;
     Esc closes only the top-most dialog when several are stacked (e.g. ChatPicker over Invite).
     It opens as the hand-built dialogs do (oc-veil-in, oc-dlg-in); it unmounts as soon as it closes. -->
<script lang="ts" module>
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  // shared with hand-built dialogs elsewhere, hence a window global
  const stack = (): object[] => ((window as unknown as { __ocDialogs?: object[] }).__ocDialogs ??= []);
</script>

<script lang="ts">
  import { useT } from '../i18n';
  import { onMount, type Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    /** Resource key (or literal text). */
    title: string;
    /** Max width, px. */
    width?: number;
    height?: string;
    /** No body padding (lists that run edge to edge). */
    flush?: boolean;
    z?: number;
    /** Opened from another dialog: a back arrow before the title, back to it. */
    onBack?: () => void;
    onClose?: () => void;
    children?: Snippet;
  }

  let { title, width = 440, height = 'min(560px,100%)', flush = false, z = 80, onBack, onClose, children }: Props = $props();
  const t = useT();

  let box: HTMLDivElement;

  onMount(() => {
    // boxRef lets a11y.js tell whether a hand-built modal sits above or below this one
    const self = { boxRef: { get current() { return box; } } };
    const returnTo = document.activeElement as HTMLElement | null;
    stack().push(self);

    const key = (e: KeyboardEvent) => {
      const s = stack();
      if (s[s.length - 1] !== self) return;
      if (e.key === 'Escape') {
        // an inner control (menu, picker) already handled this Esc
        if (e.defaultPrevented) return;
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
    aria-label={t(title)}
  >
    <div class="header" class:back={!!onBack}>
      {#if onBack}<div class="back-button"><IconButton label="ui.common.back" variant="ghost" icon="back" onClick={onBack}></IconButton></div>{/if}
      <span class="title">{t(title)}</span>
      <div class="close"><IconButton label="ui.common.close" variant="ghost" icon="close" onClick={onClose}></IconButton></div>
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
    animation: oc-veil-in var(--duration-base) var(--ease-out) both;
  }

  .dialog {
    position: relative;
    width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 24px 64px rgba(0, 0, 0, 0.55);
    outline: none;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: var(--header-h, 66px);
    box-sizing: border-box;
    padding: 0 var(--space-12) 0 var(--space-22);
    border-bottom: 1px solid var(--line-1);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close,
  .back-button {
    flex: none;
    display: flex;
  }

  /* the arrow sits where the title's padding was */
  .header.back {
    padding-inline-start: var(--space-12);
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
