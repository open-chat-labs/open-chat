<!-- The native menus' card (native design notes §1 Sheets, menus), which AnchoredMenu and LongPressMenu place:
     --surface-2, 16px radius, 48px rows of icon + label. A divider sits above the rows that ask for one (the
     destructive ones), the current value is ticked, and a row with a submenu shows a chevron: picking it replaces
     the rows in place, under a back row. The menu takes focus (a ring on the first row would show after a touch);
     arrow keys then move between rows. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { useT } from '../lib/i18n';
  import { rove } from '../lib/behaviours/rove';
  import type { NativeMenuItem } from './types';

  interface Props {
    items: NativeMenuItem[];
    /** Resource key (or literal text): the menu's accessible name. */
    label: string;
    /** A row without a submenu was picked. */
    onSelect: (id: string) => void;
    /** Take focus when it opens, and when a submenu replaces the rows. */
    autofocus?: boolean;
  }

  let { items, label, onSelect, autofocus = true }: Props = $props();
  const t = useT();

  let submenu = $state<NativeMenuItem['submenu'] | null>(null);
  let list = $state<HTMLElement>();
  const rows = $derived(submenu ? submenu.items : items);

  async function focusMenu() {
    if (!autofocus) return;
    await tick();
    list?.focus({ preventScroll: true });
  }

  function pick(item: NativeMenuItem) {
    if (item.submenu) {
      submenu = item.submenu;
      void focusMenu();
    } else {
      onSelect(item.id);
    }
  }

  function back() {
    submenu = null;
    void focusMenu();
  }

  function keyNav(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    rove(e, '[role^="menuitem"]', 'v');
  }

  function focusOnMount(_node: HTMLElement) {
    void focusMenu();
  }
</script>

<div class="menu" role="menu" aria-label={t(submenu ? submenu.title : label)} tabindex="-1" bind:this={list} onkeydown={keyNav} use:focusOnMount>
  {#if submenu}
    <button type="button" class="row back" role="menuitem" onclick={back}>
      <span class="icon back-icon"></span>
      <span class="label">{t(submenu.title)}</span>
    </button>
  {/if}
  {#each rows as item (item.id)}
    {#if item.separator}<div class="rule" role="separator"></div>{/if}
    <button
      type="button"
      class="row"
      class:danger={item.danger}
      class:selected={item.selected}
      role={item.selected !== undefined && !item.submenu ? 'menuitemradio' : 'menuitem'}
      aria-checked={item.selected !== undefined && !item.submenu ? item.selected : undefined}
      aria-haspopup={item.submenu ? 'menu' : undefined}
      onclick={() => pick(item)}
    >
      {#if item.icon}<span class="icon" style:mask="var(--icon-{item.icon}) center/contain no-repeat"></span>{/if}
      <span class="label">{t(item.label)}</span>
      {#if item.selected}<span class="tick"></span>{/if}
      {#if item.submenu}<span class="chevron"></span>{/if}
    </button>
  {/each}
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .menu {
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 6px;
    border-radius: 16px;
    background: var(--surface-2);
    box-shadow:
      var(--shadow-menu),
      inset 0 0 0 1px var(--line-1);
    outline: none;
  }

  .row {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 0 12px;
    border: 0;
    border-radius: 11px;
    background: none;
    color: var(--ink);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: var(--overlay-1);
    }

    &.danger {
      color: var(--status-danger);
    }

    &.back {
      color: var(--ink-3);
    }
  }

  .icon {
    flex: none;
    width: 19px;
    height: 19px;
    background: currentColor;
  }

  // the back row: a chevron pointing against the reading direction
  .back-icon {
    mask: var(--icon-chevron-right) center/contain no-repeat;
    transform: rotate(180deg);

    &:dir(rtl) {
      transform: none;
    }
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);

    .back & {
      font-weight: var(--weight-bold);
    }

    .selected & {
      color: var(--accent-bright);
    }
  }

  .tick {
    @include icon(check, 16px, var(--accent));
  }

  .chevron {
    @include icon(chevron-right, 13px, var(--ink-4));

    &:dir(rtl) {
      transform: scaleX(-1);
    }
  }

  .rule {
    flex: none;
    height: 1px;
    margin: 5px 6px;
    background: var(--line-1);
  }
</style>
