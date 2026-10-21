<!-- One sender's run of messages: avatar, name, then each message rendered by its kind.
     Message actions. Pointer: hover bar (3 recent reactions, 🙂, Reply/Edit, ⋯) + right-click. Keyboard: Shift+F10 / Menu key.
     Touch: long-press (onMessageMenu with touch:true → host shows focus mode). Swipe (touch, mouse drag, trackpad two-finger):
     toward start = onReply, toward end = onEdit (own text) / onSwipeLeft — rubber-banded past the threshold, accent + haptic there,
     mirrored in RTL (host: edit own / forward others'). pos always carries el (the message node) and rect for the focus clone. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy, type ComponentProps } from 'svelte';
  import type { GroupMessage } from '../types';
  import Avatar from './Avatar.svelte';
  import ChatBubble from './ChatBubble.svelte';
  import FileMessage from './FileMessage.svelte';
  import LinkPreview from './LinkPreview.svelte';
  import MediaMessage from './MediaMessage.svelte';
  import PollMessage from './PollMessage.svelte';
  import PrizeMessage from './PrizeMessage.svelte';
  import SwapOffer from './SwapOffer.svelte';
  import TransferMessage from './TransferMessage.svelte';
  import VoiceMessage from './VoiceMessage.svelte';

  type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
  type SwipeAction = 'reply' | 'edit' | 'forward';

  export interface MessageMenuPos {
    el: HTMLElement | undefined;
    rect: Rect | null;
    point?: { x: number; y: number };
    anchor?: Rect | null;
    align?: 'start' | 'end';
    keyboard?: boolean;
    fromBar?: boolean;
    touch?: boolean;
  }

  interface Props {
    side?: 'received' | 'sent';
    senderName: string;
    color?: 'violet' | 'amber' | 'teal' | 'blue';
    showAvatar?: boolean;
    showName?: boolean;
    /** With showAvatar off, keeps the avatar's space, so a sender's run split over several groups lines up. */
    avatarSpace?: boolean;
    /** Whether the last message ends the sender's run (the bubble's last-in-group shape); off when the run carries on in the next group. */
    endsRun?: boolean;
    messages: GroupMessage[];
    onMessageMenu?: (index: number, pos: MessageMenuPos) => void;
    /** Index whose menu is open: hides its hover bar and marks ⋯ as expanded. */
    activeMenu?: number;
    /** Index tinted as the current menu / reply / edit target. */
    marked?: number;
    /** First three are offered on the hover bar. */
    recentReactions?: string[];
    onReact?: (index: number, emoji: string) => void;
    onReactPicker?: (index: number, pos: MessageMenuPos) => void;
    onReply?: (index: number, el?: HTMLElement) => void;
    /** Own text messages only. */
    onEdit?: (index: number, el?: HTMLElement) => void;
    onSwipeLeft?: (index: number) => void;
  }

  let {
    side = 'received',
    senderName,
    color = 'violet',
    showAvatar = true,
    showName = true,
    avatarSpace = false,
    endsRun = true,
    messages,
    onMessageMenu,
    activeMenu = -1,
    marked = -1,
    recentReactions = [],
    onReact,
    onReactPicker,
    onReply,
    onEdit,
    onSwipeLeft,
  }: Props = $props();
  const t = useT();

  const SWIPE_AT = 150;
  const SWIPE_MAX = 400;
  const BAR_W = 196; // hover bar width (3 reactions, picker, divider, reply/edit, more)

  const rows: HTMLDivElement[] = $state([]);
  const mores: HTMLSpanElement[] = $state([]);
  const emojis: HTMLSpanElement[] = $state([]);

  let hover = $state(-1);
  let barLeft = $state('8px');

  // gesture bookkeeping (never rendered)
  let touch = false;
  let pending: number | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let pressFired = false;
  let justSwiped = 0;
  let gesture: { x: number; y: number; i: number; swiping: boolean; id: number; type: string } | null = null;
  let swipe: { i: number; d: number; past: boolean } | null = null;
  let wheel: { i: number; dx: number } | null = null;
  onDestroy(() => {
    clearTimeout(hoverTimer);
    clearTimeout(pressTimer);
    clearTimeout(wheelTimer);
  });

  const quickReactions = $derived((recentReactions.length ? recentReactions : ['👍', '❤️', '😂']).slice(0, 3));
  const isText = (m: GroupMessage) => !m.kind || m.kind === 'text';
  const menuable = (m: GroupMessage) => !!onMessageMenu && !m.deleted;

  function rectOf(el: Element | null | undefined): Rect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  }

  function pos(i: number, extra: Partial<MessageMenuPos> = {}): MessageMenuPos {
    return { el: rows[i], rect: rectOf(rows[i]), ...extra };
  }

  function openMenu(i: number, extra: Partial<MessageMenuPos>) {
    onMessageMenu?.(i, pos(i, extra));
  }

  // the visual bubble inside a full-width row: descend while the element spans the row, stop at the first narrower one
  function bubbleOf(wrap: HTMLElement | undefined) {
    if (!wrap) return null;
    const W = wrap.getBoundingClientRect();
    let el: Element | null | undefined = [...wrap.children].find(
      (c) => !c.hasAttribute('data-msg-acts') && !c.hasAttribute('data-swipe-hint') && !c.hasAttribute('data-swipe-hint-end') && !c.hasAttribute('data-msg-mark'),
    );
    for (let n = 0; el && n < 8; n++) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < W.width - 1) return { left: r.left - W.left, width: r.width };
      el = el.firstElementChild;
    }
    return { left: 0, width: W.width };
  }

  function barLeftFor(i: number) {
    const b = bubbleOf(rows[i]);
    if (!b) return '8px';
    return `${b.width >= BAR_W + 16 ? b.left + b.width - BAR_W - 8 : b.left}px`;
  }

  function showBar(i: number) {
    barLeft = barLeftFor(i);
    hover = i;
  }

  // own text: right = edit, left = reply · everything else: right = reply, left = forward
  function swipeMap(m: GroupMessage): { right: SwipeAction; left: SwipeAction } {
    return side === 'sent' && isText(m) && !!onEdit ? { right: 'edit', left: 'reply' } : { right: 'reply', left: 'forward' };
  }

  function swipeAllowed(m: GroupMessage) {
    const map = swipeMap(m);
    const has = (a: SwipeAction) => (a === 'edit' ? !!onEdit : a === 'reply' ? !!onReply : !!onSwipeLeft);
    return { right: has(map.right), left: has(map.left) };
  }

  // swipe: logical dx (+ = toward the reply side; flips for RTL), free up to the threshold then rubber-banded
  function swipeTo(i: number, raw: number, m: GroupMessage) {
    const el = rows[i];
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const ok = swipeAllowed(m);
    let d = rtl ? -raw : raw;
    if ((d > 0 && !ok.right) || (d < 0 && !ok.left)) d = 0;
    const a = Math.abs(d);
    d = Math.sign(d) * (a <= SWIPE_AT ? a : Math.min(SWIPE_MAX, SWIPE_AT + (a - SWIPE_AT) * 0.6));
    const g = swipe && swipe.i === i ? swipe : (swipe = { i, d: 0, past: false });
    g.d = d;
    el.style.transition = 'none';
    el.style.transform = `translateX(${rtl ? -d : d}px)`;
    const past = Math.abs(d) >= SWIPE_AT;
    const crossed = past && !g.past;
    if (crossed) navigator.vibrate?.(10);
    g.past = past;
    const paint = (h: HTMLElement | null, on: boolean, amount: number) => {
      if (!h) return;
      h.style.display = on ? 'flex' : 'none';
      h.style.opacity = String(Math.min(1, amount / SWIPE_AT));
      h.style.transform = past && on ? 'scale(1.3)' : 'scale(1)';
      if (crossed && on)
        h.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.55)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1.38)' }, { transform: 'scale(1.3)' }], {
          duration: 420,
          easing: 'ease-out',
        });
      h.style.background = past && on ? 'var(--accent)' : 'var(--overlay-2)';
      const icon = h.firstElementChild as HTMLElement | null;
      if (icon) icon.style.background = past && on ? 'var(--on-accent)' : 'var(--ink)';
    };
    paint(el.querySelector('[data-swipe-hint]'), d > 0, Math.max(0, d));
    paint(el.querySelector('[data-swipe-hint-end]'), d < 0, Math.max(0, -d));
  }

  function swipeEnd(i: number, m: GroupMessage) {
    const el = rows[i];
    const g = swipe && swipe.i === i ? swipe : null;
    swipe = null;
    if (el) {
      el.style.transition = 'transform .22s cubic-bezier(.2,.8,.3,1.2)';
      el.style.transform = '';
      el.querySelectorAll<HTMLElement>('[data-swipe-hint],[data-swipe-hint-end]').forEach((n) => {
        n.style.opacity = '0';
        n.style.display = 'none';
        n.style.transform = 'scale(1)';
      });
    }
    if (!g || Math.abs(g.d) < SWIPE_AT) return;
    const act = g.d > 0 ? swipeMap(m).right : swipeMap(m).left;
    if (act === 'edit') onEdit?.(i, el);
    else if (act === 'reply') onReply?.(i, el);
    else onSwipeLeft?.(i);
  }

  function primary(i: number, m: GroupMessage) {
    hover = -1;
    if (side === 'sent' && isText(m) && onEdit) onEdit(i, rows[i]);
    else onReply?.(i, rows[i]);
  }

  const onKeys = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  function reactPicker(i: number) {
    const bar = emojis[i]?.closest('[data-msg-acts]');
    onReactPicker?.(i, pos(i, { anchor: rectOf(bar ?? emojis[i]), align: 'end' }));
  }

  // the bar belongs to the bubble: show it only while the cursor is over the bubble (or the bar itself)
  function mouseMove(e: MouseEvent, i: number, m: GroupMessage) {
    if (!menuable(m) || touch) return;
    const target = e.target as Element;
    let over = !!target.closest?.('[data-msg-acts]');
    if (!over) {
      const w = rows[i], b = bubbleOf(w);
      if (w && b) {
        const x = e.clientX - w.getBoundingClientRect().left;
        over = x >= b.left && x <= b.left + b.width;
      }
    }
    if (over && hover !== i) {
      // short intent delay so the bar doesn't flicker while the cursor passes over the chat
      if (pending !== i) {
        clearTimeout(hoverTimer);
        pending = i;
        hoverTimer = setTimeout(() => {
          pending = null;
          showBar(i);
        }, 350);
      }
    } else if (!over) {
      if (pending === i) {
        clearTimeout(hoverTimer);
        pending = null;
      }
      if (hover === i) hover = -1;
    }
  }

  function leave(i: number) {
    if (pending === i) {
      clearTimeout(hoverTimer);
      pending = null;
    }
    if (hover === i) hover = -1;
  }

  function contextMenu(e: MouseEvent, i: number, m: GroupMessage) {
    if (!menuable(m)) return;
    if ((e.target as Element).closest?.('a,input,textarea')) return;
    e.preventDefault();
    if (pressFired) {
      pressFired = false;
      return;
    }
    openMenu(i, { point: { x: e.clientX, y: e.clientY } });
  }

  function keyDown(e: KeyboardEvent, i: number, m: GroupMessage) {
    if (!menuable(m)) return;
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      openMenu(i, { anchor: rectOf(rows[i]), align: side === 'sent' ? 'end' : 'start', keyboard: true });
    }
  }

  function pointerDown(e: PointerEvent, i: number, m: GroupMessage) {
    touch = e.pointerType === 'touch';
    if (!menuable(m)) return;
    if (e.pointerType === 'mouse' && (e.button !== 0 || (e.target as Element).closest?.('a,button,input,textarea,[role=button],[data-msg-acts],[role=slider]'))) return;
    gesture = { x: e.clientX, y: e.clientY, i, swiping: false, id: e.pointerId, type: e.pointerType };
    clearTimeout(pressTimer);
    if (touch)
      pressTimer = setTimeout(() => {
        if (!gesture || gesture.swiping) return;
        pressFired = true;
        navigator.vibrate?.(8);
        openMenu(i, { touch: true });
        gesture = null;
      }, 500);
  }

  function pointerMove(e: PointerEvent, i: number, m: GroupMessage) {
    const g = gesture;
    if (!g || g.i !== i || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.swiping) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        clearTimeout(pressTimer);
        gesture = null;
        return;
      }
      if (!(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy))) return;
      g.swiping = true;
      clearTimeout(pressTimer);
      hover = -1;
      try {
        rows[i].setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone (released or cancelled): nothing to capture
      }
      window.getSelection?.()?.removeAllRanges();
    }
    e.preventDefault();
    swipeTo(i, dx, m);
  }

  function pointerUp(i: number, m: GroupMessage) {
    clearTimeout(pressTimer);
    const g = gesture;
    gesture = null;
    if (!g || g.i !== i || !g.swiping) return;
    if (g.type === 'mouse') justSwiped = Date.now();
    swipeEnd(i, m);
  }

  // trackpad: two-finger horizontal scroll drives the same swipe; ends ~140ms after the last wheel event
  function onWheel(e: WheelEvent, i: number, m: GroupMessage) {
    if (!menuable(m) || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 1) return;
    const w = wheel && wheel.i === i ? wheel : (wheel = { i, dx: 0 });
    w.dx -= e.deltaX;
    swipeTo(i, w.dx, m);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheel = null;
      swipeEnd(i, m);
    }, 140);
  }

  // a mouse drag that swiped must not also click whatever it ended over
  function clickCapture(e: MouseEvent) {
    if (justSwiped && Date.now() - justSwiped < 300) {
      e.stopPropagation();
      e.preventDefault();
      justSwiped = 0;
    }
  }
</script>

<div class="group">
  {#if showAvatar}
    <span class="avatar"><Avatar size={34} {color} online={false} /></span>
  {:else if avatarSpace}
    <span class="avatar-space" aria-hidden="true"></span>
  {/if}
  <div class="column">
    {#if showName}
      <span class="name">{senderName}</span>
    {/if}
    {#each messages as m, i (m.id ?? i)}
      {@const last = i === messages.length - 1 && endsRun}
      {@const map = swipeMap(m)}
      {@const mine = (m.reactions ?? []).filter((r) => r.mine).map((r) => r.emoji)}
      {@const canEdit = side === 'sent' && isText(m) && !!onEdit}
      <div
        class="message"
        class:marked={marked === i}
        bind:this={rows[i]}
        data-msg={m.id ?? ''}
        onmousemove={(e) => mouseMove(e, i, m)}
        onmouseleave={() => leave(i)}
        onfocusin={() => menuable(m) && !touch && hover !== i && showBar(i)}
        onfocusout={(e) => !rows[i]?.contains(e.relatedTarget as Node | null) && hover === i && (hover = -1)}
        oncontextmenu={(e) => contextMenu(e, i, m)}
        onkeydown={(e) => keyDown(e, i, m)}
        onpointerdown={(e) => pointerDown(e, i, m)}
        onpointermove={(e) => pointerMove(e, i, m)}
        onpointerup={() => pointerUp(i, m)}
        onpointercancel={() => pointerUp(i, m)}
        onwheel={(e) => onWheel(e, i, m)}
        onclickcapture={clickCapture}
        draggable="false"
        ondragstart={(e) => e.preventDefault()}
        role="group"
      >
        <span class="mark" aria-hidden="true" data-msg-mark=""></span>
        <span class="hint start" aria-hidden="true" data-swipe-hint=""><span class="hint-icon" style:mask="var(--icon-{map.right}) center/contain no-repeat"></span></span>
        <span class="hint end" aria-hidden="true" data-swipe-hint-end=""><span class="hint-icon" style:mask="var(--icon-{map.left}) center/contain no-repeat"></span></span>
        {#if m.kind === 'voice'}
          <VoiceMessage {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'image' || m.kind === 'album' || m.kind === 'video' || m.kind === 'gif'}
          <MediaMessage {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'file'}
          <FileMessage {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'link'}
          <LinkPreview {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'transfer'}
          <TransferMessage {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'swap'}
          <SwapOffer {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'poll'}
          <PollMessage {...m} {side} lastInGroup={last} />
        {:else if m.kind === 'prize'}
          <PrizeMessage {...m} lastInGroup={last} />
        {:else if !m.kind || m.kind === 'text'}
          <ChatBubble {...(m as ComponentProps<typeof ChatBubble>)} {side} lastInGroup={last} onToggleReaction={(c) => onReact?.(i, c)} />
        {/if}
        {#if menuable(m) && hover === i && !touch && activeMenu !== i}
          <span class="bar" style:left={barLeft} data-msg-acts="" role="toolbar" aria-label={t('ui.messageGroup.actions')}>
            {#each quickReactions as c}
              {@const on = mine.includes(c)}
              <span
                class="quick"
                class:on
                onclick={() => onReact?.(i, c)}
                onkeydown={onKeys(() => onReact?.(i, c))}
                role="button"
                tabindex="0"
                aria-label={t(on ? 'ui.messageGroup.removeReaction' : 'ui.messageGroup.react', { emoji: c })}
                aria-pressed={on}>{c}</span
              >
            {/each}
            <span
              class="tool"
              bind:this={emojis[i]}
              onclick={(e) => {
                e.stopPropagation();
                reactPicker(i);
              }}
              onkeydown={onKeys(() => reactPicker(i))}
              role="button"
              tabindex="0"
              aria-label={t('ui.messageGroup.moreReactions')}
              aria-haspopup="dialog"
              data-tip={t('ui.messageGroup.reactTip')}><span class="tool-icon" style:mask="var(--icon-emoji) center/contain no-repeat"></span></span
            >
            <span class="divider"></span>
            <span
              class="tool"
              onclick={() => primary(i, m)}
              onkeydown={onKeys(() => primary(i, m))}
              role="button"
              tabindex="0"
              aria-label={t(canEdit ? 'ui.common.edit' : 'ui.common.reply')}
              data-tip={t(canEdit ? 'ui.common.edit' : 'ui.common.reply')}><span class="tool-icon" style:mask="var(--icon-{canEdit ? 'edit' : 'reply'}) center/contain no-repeat"></span></span
            >
            <span
              class="tool"
              class:active={activeMenu === i}
              bind:this={mores[i]}
              onclick={(e) => {
                e.stopPropagation();
                if (activeMenu !== i) openMenu(i, { anchor: rectOf(mores[i]), align: 'end', fromBar: true });
              }}
              onkeydown={onKeys(() => openMenu(i, { anchor: rectOf(mores[i]), align: 'end', keyboard: true, fromBar: true }))}
              aria-label={t('ui.messageGroup.moreActions')}
              aria-haspopup="menu"
              aria-expanded={activeMenu === i}
              role="button"
              tabindex="0"
              data-tip={t('ui.common.more')}><span class="tool-icon" style:mask="var(--icon-more) center/contain no-repeat"></span></span
            >
          </span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .group {
    position: relative;
    z-index: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    gap: var(--space-10);
    align-items: flex-start;
    flex-direction: row;
  }

  .avatar {
    position: relative;
    z-index: 1;
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    overflow: visible;
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--surface-1);
  }

  .avatar-space {
    flex: none;
    width: 34px;
  }

  .column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    align-items: stretch;
    text-align: start;
  }

  .name {
    padding: 0 var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .message {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    border-radius: var(--radius-lg);
    -webkit-touch-callout: none;
    touch-action: pan-y;
    z-index: auto;
  }

  .message.marked {
    z-index: 0;
  }

  /* row tint while this message is the menu / reply / edit target */
  .mark {
    position: absolute;
    top: -5px;
    bottom: -5px;
    inset-inline-start: -64px;
    inset-inline-end: -24px;
    z-index: -1;
    border-radius: 0;
    background: color-mix(in oklch, var(--ink) 2.5%, transparent);
    opacity: 0;
    transition: opacity 0.2s ease-out;
    pointer-events: none;
  }

  .marked .mark {
    opacity: 1;
  }

  /* swipe hints: shown and painted from script while a swipe is in progress */
  .hint {
    position: absolute;
    top: 50%;
    transition:
      transform 0.14s ease-out,
      background 0.14s;
    width: 26px;
    height: 26px;
    margin-top: -13px;
    border-radius: 50%;
    background: var(--overlay-2);
    display: none;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
  }

  .hint.start {
    inset-inline-start: -48px;
  }

  .hint.end {
    inset-inline-end: -34px;
  }

  .hint-icon {
    width: 14px;
    height: 14px;
    background: var(--ink);
  }

  .bar {
    position: absolute;
    top: -26px;
    z-index: 3;
    animation: ocActsIn 0.16s ease-out;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 34px;
    padding: 0 3px;
    border-radius: 17px;
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 8px 20px rgba(0, 0, 0, 0.4);
  }

  .quick,
  .tool {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .quick {
    font-size: 16px;
    line-height: 1;
    user-select: none;
    background: transparent;
    transition: transform 0.12s;
  }

  .quick.on {
    background: var(--accent-soft);
  }

  .quick:hover {
    background: var(--overlay-2);
    transform: scale(1.14);
  }

  .tool {
    background: transparent;
    color: var(--ink-2);
  }

  .tool.active {
    background: var(--overlay-2);
  }

  .tool:hover {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .quick:focus-visible,
  .tool:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .tool-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .divider {
    width: 1px;
    height: 16px;
    margin: 0 3px;
    background: var(--line-2);
  }
</style>
