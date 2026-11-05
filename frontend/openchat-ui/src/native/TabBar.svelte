<!-- Native tab bar (native design notes §1 Structure 1): icon-only tabs, 20px icons in touch-target cells (44pt iOS,
     48dp Android, from the root's data-os), 10px above them and the safe area (at least 12px) below. An unread count
     pill (Chats), an accent dot (Activity), the user's 26px photo in place of the icon (You), ringed in the accent
     when selected. A tap bounces the icon (0.78 → 1.16 → 1 over 600ms; not with reduced motion) and gives a light
     haptic. onSelect fires on every tap, the selected tab's too: the host takes that tab's stack back to its root. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import { rove } from '../lib/behaviours/rove';
  import { cssUrl } from '../lib/cssUrl';
  import { haptic } from './haptics';
  import type { NativeTab } from './types';

  interface Props {
    tabs: NativeTab[];
    /** The selected tab's id. */
    selected: string;
    /** Every tap, the selected tab's included. */
    onSelect: (id: string) => void;
    /** Resource key (or literal text): the bar's accessible name. */
    label?: string;
  }

  let { tabs, selected, onSelect, label = 'ui.native.tabBar.label' }: Props = $props();
  const t = useT();

  // the tap: squash on press, springy overshoot back (Web Animations, so a re-render mid-way doesn't restart it)
  const BOUNCE: Keyframe[] = [
    { transform: 'scale(1)' },
    { transform: 'scale(.78)', offset: 0.22 },
    { transform: 'scale(1.16)', offset: 0.55 },
    { transform: 'scale(.96)', offset: 0.78 },
    { transform: 'scale(1)' },
  ];

  function bounce(e: PointerEvent & { currentTarget: HTMLElement }) {
    if (e.button > 0) return;
    const icon = e.currentTarget.querySelector<HTMLElement>('[data-tab-icon]');
    if (!icon?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    icon.animate(BOUNCE, { duration: 600, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }

  function pick(id: string) {
    haptic('light');
    onSelect(id);
  }

  function keyNav(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    rove(e, '[role="tab"]', 'h')?.click();
  }

  function name(tab: NativeTab): string {
    const text = t(tab.label);
    if (tab.count) return t('ui.native.tabBar.unread', { label: text, count: tab.count });
    return tab.dot ? t('ui.native.tabBar.new', { label: text }) : text;
  }
</script>

<div class="tab-bar" role="tablist" aria-label={t(label)} tabindex="-1" onkeydown={keyNav}>
  {#each tabs as tab (tab.id)}
    {@const on = tab.id === selected}
    <button type="button" class="tab" class:on role="tab" aria-selected={on} aria-label={name(tab)} tabindex={on ? 0 : -1} onpointerdown={bounce} onclick={() => pick(tab.id)}>
      {#if tab.avatarUrl}
        <span class="avatar" style:background-image={cssUrl(tab.avatarUrl)} data-tab-icon></span>
      {:else}
        <span class="icon" style:mask="var(--icon-{tab.icon}) center/contain no-repeat" data-tab-icon></span>
      {/if}
      {#if tab.count}
        <span class="count" aria-hidden="true">{tab.count}</span>
      {:else if tab.dot}
        <span class="dot" aria-hidden="true"></span>
      {/if}
    </button>
  {/each}
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .tab-bar {
    flex: none;
    display: flex;
    padding: 10px 6px var(--bar-end);
    background: var(--surface-0);
    box-shadow: inset 0 1px 0 var(--line-1);
  }

  .tab {
    position: relative;
    flex: 1;
    min-width: 0;
    height: var(--touch-target);
    @include flex-center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-4);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &.on {
      color: var(--accent);
    }
  }

  .icon {
    width: 20px;
    height: 20px;
    background: currentColor;
  }

  .avatar {
    width: 26px;
    height: 26px;
    border-radius: var(--radius-circle);
    background: var(--overlay-2) center/cover no-repeat;
    box-shadow: 0 0 0 1px var(--line-2);
    transition: box-shadow 0.2s;

    .on & {
      box-shadow:
        0 0 0 2px var(--surface-0),
        0 0 0 4px var(--accent);
    }
  }

  .count {
    position: absolute;
    top: 2px;
    inset-inline-start: calc(50% + 4px);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 9px;
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--surface-0);
    font: var(--weight-bold) text-size(10.5px) / 18px var(--font-sans);
    text-align: center;
    color: var(--on-accent);
  }

  .dot {
    position: absolute;
    top: 10px;
    inset-inline-start: calc(50% + 5px);
    width: 9px;
    height: 9px;
    border-radius: var(--radius-circle);
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--surface-0);
  }

  @include reduced-motion {
    .avatar {
      transition: none;
    }
  }
</style>
