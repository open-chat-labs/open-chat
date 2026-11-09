<!-- A message's long-press menu (native design notes §3.3): the message stays where it is, and a copy of it sits over
     it above the dimmed, blurred chat (the message itself hides meanwhile); the quick reactions bar (with + for more)
     and the action card line up with its bubble's start edge (received) or end edge (sent), 12px inside the screen,
     placed by messageMenuPlacement (reactions above and the card below, else the card above and the reactions below,
     else both above, else both below). The copy keeps its ancestors' classes and custom properties (but none of their
     layout), so it looks as the message does. A tap outside, Esc or a pick closes it: the veil, the reactions and
     the card fade out in 170ms while the copy stays as it is, over the hidden message, until they're gone (fading it
     too would show the dimmed chat through it, and the message blink back in at the end); the press that opened it
     ends without closing it. It's a fixed layer over the native root. Reduced motion:
     no scale or fade. -->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { useT } from '../lib/i18n';
  import { modal } from '../lib/behaviours/modal';
  import NativeMenu from './NativeMenu.svelte';
  import { Presence } from './presence.svelte';
  import { LIFT_MENU_WIDTH, menuHeight, messageMenuPlacement, type MessageMenuPlacement, type Rect } from './menuPlacement';
  import type { NativeMenuItem } from './types';

  const LEAVE_MS = 170;
  // what in a message's row isn't the message: the swipe hints, the mark, the hover bar
  const DECOR = '[data-swipe-hint],[data-swipe-hint-end],[data-msg-mark],[data-msg-acts]';
  // what the host finds its messages by (`data-msg`, a list's `data-index` / `data-id`): left off the copy, so only the
  // message itself answers to them
  const FOUND_BY = ['id', 'data-msg', 'data-index', 'data-id'];
  // how far up the copy keeps its ancestors' classes
  const ANCESTORS = 24;
  // an ancestor's shell in the copy: its classes and custom properties, none of its layout
  const NEUTRAL =
    'display:block;position:static;inset:auto;margin:0;padding:0;border:0;width:auto;height:auto;min-width:0;min-height:0;' +
    'max-width:none;max-height:none;overflow:visible;transform:none;background:none;box-shadow:none;opacity:1;' +
    'visibility:visible;animation:none;transition:none;contain:none;content-visibility:visible';

  interface Props {
    open: boolean;
    /** The pressed message's row (MessageGroup's `pos.el`): where the copy sits, hidden while the menu is open. */
    target: HTMLElement | null;
    /** The bubble's side: the reactions and the card line up with its start edge (received) or end edge (sent). */
    side: 'received' | 'sent';
    items: NativeMenuItem[];
    /** Resource key (or literal text): the menu's accessible name. */
    label: string;
    /** The quick reactions; none (or no `onReact`): no reactions bar. */
    reactions?: string[];
    /** The reader's own reactions on the message, shown picked (picking one again takes it off: the host's call). */
    selected?: string[];
    /** A quick reaction was picked; the menu has asked to close just before. */
    onReact?: (emoji: string) => void;
    /** The bar's +: more reactions (the host's picker); the menu has asked to close just before. None: no +. */
    onMoreReactions?: () => void;
    /** A row was picked; the menu has asked to close (onClose) just before. */
    onSelect: (id: string) => void;
    /** A tap outside, Esc, or a pick. The menu fades out once `open` turns false. */
    onClose: () => void;
  }

  let { open, target, side, items, label, reactions = [], selected = [], onReact, onMoreReactions, onSelect, onClose }: Props = $props();
  const t = useT();

  const withBar = $derived(!!onReact && reactions.length > 0);

  // A tap outside closes it: a click on the veil whose press started there too. The press that opened the menu
  // started on the message, under where the veil now is, and its release can end in a click on the veil.
  let pressedVeil = false;

  const presence = new Presence(LEAVE_MS);
  // the message it opened on, kept while it fades out
  let lifted = $state<HTMLElement | null>(null);
  // where it was, measured as it opened (the list doesn't move under the veil)
  let row = $state<Rect | null>(null);
  $effect.pre(() => {
    const now = open && !!target;
    const el = target;
    untrack(() => {
      if (now && el) {
        lifted = el;
        const r = el.getBoundingClientRect();
        row = { left: r.left, top: r.top, width: r.width, height: r.height };
        pressedVeil = false;
      }
      presence.set(now);
    });
  });
  onDestroy(() => presence.dispose());

  let frame = $state<HTMLElement>();
  let bar = $state<HTMLElement>();
  let placement = $state<MessageMenuPlacement | null>(null);
  let frameBox = $state<Rect>({ left: 0, top: 0, width: 0, height: 0 });

  $effect(() => {
    if (!presence.mounted || !lifted || !frame || !row) {
      placement = null;
      return;
    }
    const box = frame;
    const el = lifted;
    const rows = items;
    const barEl = withBar ? bar : undefined;
    if (withBar && !barEl) return;
    untrack(() => {
      const f = box.getBoundingClientRect();
      frameBox = { left: f.left, top: f.top, width: f.width, height: f.height };
      const rtl = getComputedStyle(box).direction === 'rtl';
      const size = barEl ? { width: barEl.offsetWidth, height: barEl.offsetHeight } : null;
      placement = messageMenuPlacement(messageBox(el, row!), frameBox, size, { width: LIFT_MENU_WIDTH, height: menuHeight(rows) }, side, rtl);
    });
  });

  // the message hides while its copy is over it, until the menu is gone
  $effect(() => {
    const el = presence.mounted ? lifted : null;
    if (!el) return;
    const was = el.style.visibility;
    el.style.visibility = 'hidden';
    return () => {
      el.style.visibility = was;
    };
  });

  // the message's box: its row's height, and the width its bubble (and what's under it) takes in the row
  function messageBox(el: HTMLElement, r: Rect): Rect {
    let left = Infinity;
    let right = -Infinity;
    for (const child of el.children) {
      if (child.matches(DECOR)) continue;
      const b = visualBox(child, r.width);
      if (b.width === 0) continue;
      left = Math.min(left, b.left);
      right = Math.max(right, b.left + b.width);
    }
    return Number.isFinite(left) ? { left, top: r.top, width: right - left, height: r.height } : r;
  }

  // an element as it shows: the first one down from it narrower than the row (a bubble inside a full-width wrapper)
  function visualBox(el: Element, rowWidth: number): DOMRect {
    let node: Element | null = el;
    for (let n = 0; node && n < 8; n++) {
      const b = node.getBoundingClientRect();
      if (b.width > 0 && b.width < rowWidth - 1) return b;
      node = node.firstElementChild;
    }
    return el.getBoundingClientRect();
  }

  // the copy: the row itself, inside shells of its ancestors that keep their classes and custom properties (the styles
  // that reach the message through them) but none of their layout
  function copyOf(node: HTMLElement, from: HTMLElement | null) {
    if (!from || !row) return;
    const deep = from.cloneNode(true) as HTMLElement;
    deep.querySelectorAll(DECOR).forEach((n) => n.remove());
    const unfind = (n: Element) => FOUND_BY.forEach((a) => n.removeAttribute(a));
    unfind(deep);
    deep.querySelectorAll(FOUND_BY.map((a) => `[${a}]`).join(',')).forEach(unfind);
    deep.style.visibility = '';
    deep.style.transform = '';
    deep.style.transition = '';
    deep.style.margin = '0';
    deep.style.width = `${row.width}px`;
    let copy: HTMLElement = deep;
    let ancestor = from.parentElement;
    for (let n = 0; ancestor && n < ANCESTORS && ancestor !== document.body; n++, ancestor = ancestor.parentElement) {
      const shell = ancestor.cloneNode(false) as HTMLElement;
      unfind(shell);
      shell.style.cssText += `;${NEUTRAL}`;
      shell.appendChild(copy);
      copy = shell;
    }
    node.replaceChildren(copy);
  }

  function pick(id: string) {
    onClose();
    onSelect(id);
  }

  function react(emoji: string) {
    onClose();
    onReact?.(emoji);
  }

  function more() {
    onClose();
    onMoreReactions?.();
  }

  // focus goes back to the message once it's visible again
  function returnFocus(_node: HTMLElement, to: HTMLElement | null) {
    return {
      destroy() {
        setTimeout(() => {
          if (to?.isConnected) to.focus({ preventScroll: true });
        }, 0);
      },
    };
  }

  function veilClick() {
    if (pressedVeil) onClose();
    pressedVeil = false;
  }

  // Tab leaves a menu (it closes, and focus goes back to the message), as menus do
  function keydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || presence.leaving) return;
    e.preventDefault();
    onClose();
  }
</script>

{#if presence.mounted && lifted && row}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="layer" class:closing={presence.leaving} use:modal={presence.leaving ? undefined : onClose} use:returnFocus={lifted} onkeydown={keydown}>
    <!-- Esc closes it too -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="veil" onpointerdown={() => (pressedVeil = true)} onpointercancel={() => (pressedVeil = false)} onclick={veilClick}></div>
    <div class="frame" bind:this={frame}>
      <div
        class="copy"
        style:left="{row.left - frameBox.left}px"
        style:top="{row.top - frameBox.top}px"
        style:width="{row.width}px"
        aria-hidden="true"
        inert
        use:copyOf={lifted}
      ></div>
      {#if withBar}
        <div
          class="bar"
          class:placed={!!placement}
          bind:this={bar}
          style:top="{placement?.bar?.top ?? 0}px"
          style:inset-inline-start="{placement?.bar?.inlineStart ?? 0}px"
          style:transform-origin={placement?.bar?.origin}
          role="group"
          aria-label={t('ui.messageActions.label')}
        >
          {#each reactions as emoji (emoji)}
            {@const on = selected.includes(emoji)}
            <button
              type="button"
              class="emoji"
              class:on
              aria-pressed={on}
              aria-label={t(on ? 'ui.messageActions.removeReaction' : 'ui.messageActions.react', { emoji })}
              onclick={() => react(emoji)}>{emoji}</button
            >
          {/each}
          {#if onMoreReactions}
            <button type="button" class="more" aria-label={t('ui.messageActions.moreReactions')} onclick={more}><span class="more-icon"></span></button>
          {/if}
        </div>
      {/if}
      {#if placement}
        <div
          class="pop"
          style:top="{placement.menu.top}px"
          style:inset-inline-start="{placement.menu.inlineStart}px"
          style:max-height="{placement.menu.maxHeight}px"
          style:transform-origin={placement.menu.origin}
        >
          <NativeMenu {items} {label} onSelect={pick} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);

    &.closing {
      pointer-events: none;
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--veil-lift);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    animation: fade-in 0.2s ease-out;
  }

  .frame {
    position: absolute;
    inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    pointer-events: none;
  }

  // the message's copy, exactly over it
  .copy {
    position: absolute;
    pointer-events: none;
  }

  // the quick reactions: a pill of 44px (48px on Android) emoji, then +
  .bar {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    box-shadow:
      var(--shadow-menu),
      inset 0 0 0 1px var(--line-1);
    pointer-events: auto;
    visibility: hidden;

    &.placed {
      visibility: visible;
      animation: menu-in 0.2s var(--ease-out);
    }
  }

  .emoji,
  .more {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-circle);
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: var(--overlay-1);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .emoji {
    font-size: 26px;
    line-height: 1;

    &.on {
      background: var(--accent-soft);
    }
  }

  .more {
    background: var(--overlay-1);
  }

  .more-icon {
    @include icon(plus, 20px, var(--ink-2));
  }

  .pop {
    position: absolute;
    width: 240px;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    animation: menu-in 0.2s var(--ease-out) 0.04s backwards;
  }

  // the copy doesn't fade: it stays over the hidden message until the layer is gone, so nothing blinks
  .veil,
  .bar,
  .pop {
    transition: opacity 0.18s;

    .closing & {
      opacity: 0;
    }
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @include reduced-motion {
    .veil,
    .copy,
    .bar,
    .bar.placed,
    .pop {
      transition: none;
      animation: none;
    }
  }
</style>
