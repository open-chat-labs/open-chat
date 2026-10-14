<!-- App navigation rail: destinations (chats, notifications, wallet …), pinned communities, create / explore,
     the CHIT streak button, profile and a collapse toggle. Collapsed it is an icon column; expanded it shows labels.
     When the host gives the rail a fixed slot ([data-rail-slot] narrower than 200px) the expanded rail floats over the
     content, so it closes again on an outside press or a pick. Guests get Home and Sign in instead of their own items. -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { useT } from '../../lib/i18n';

  // nav item keys → canonical names in lib/icons.js
  const ICONS = { messages: 'messages', bell: 'bell', wallet: 'wallet', chit: 'zap', heart: 'heart' };
  // default accessible names (resource keys)
  const NAMES = { messages: 'ui.navRail.chats', bell: 'ui.navRail.notifications', wallet: 'ui.navRail.wallet', chit: 'ui.navRail.chitRewards', heart: 'ui.navRail.favourites' };
  const GRADIENTS = {
    sunset: 'linear-gradient(140deg,#ff8a3d,#ff2d74)',
    blue: 'linear-gradient(140deg,#3d7bff,#7a3dff)',
    teal: 'linear-gradient(140deg,#2ee6a8,#1f8fbf)',
    plum: 'linear-gradient(140deg,#b04dff,#4d2dff)',
  };

  type ItemIcon = keyof typeof ICONS;

  interface Item {
    icon: ItemIcon;
    /** Resource key (or literal text). */
    label?: string;
    /** Shows the unread count (expanded) or a dot (collapsed). */
    dot?: boolean;
    count?: number;
  }

  interface Pin {
    color: keyof typeof GRADIENTS;
    name?: string;
    /** Accessible name. Resource key (or literal text); defaults to the name. */
    label?: string;
    dot?: boolean;
    /** Previewing a community you haven't joined: dashed outline and an eye badge. */
    preview?: boolean;
  }

  interface Props {
    items: Item[];
    pins: Pin[];
    expanded?: boolean;
    activeIndex?: number;
    /** Selected pin; set it to control pin selection from outside. */
    activePin?: number | null;
    profileLabel: string;
    profileHandle: string;
    onSelect?: (i: number) => void;
    onSelectPin?: (i: number) => void;
    exploreActive?: boolean;
    onExplore?: () => void;
    guest?: boolean;
    /** Guests: where Home goes. */
    homeHref?: string;
    onSignIn?: () => void;
    onCreateCommunity?: () => void;
    chitShown?: boolean;
    chitStreak?: number;
    /** Today's CHIT is still to claim. */
    chitClaimable?: boolean;
    /** Today's puzzle is ready (adds to the CHIT dot). */
    puzzleDue?: boolean;
    onChit?: () => void;
    onProfile?: () => void;
  }

  let {
    items,
    pins,
    expanded = false,
    activeIndex = 0,
    activePin,
    profileLabel,
    profileHandle,
    onSelect,
    onSelectPin,
    exploreActive = false,
    onExplore,
    guest = false,
    homeHref = '/',
    onSignIn,
    onCreateCommunity,
    chitShown = true,
    chitStreak = 0,
    chitClaimable = false,
    puzzleDue = false,
    onChit,
    onProfile,
  }: Props = $props();
  const t = useT();

  // local clicks win until the host changes the matching prop
  let open = $derived(expanded);
  let localActive = $derived.by<number | null>(() => {
    void activeIndex;
    return null;
  });
  let localPin = $derived.by<number | null | undefined>(() => {
    void activeIndex;
    void activePin;
    return undefined;
  });

  const pinIndex = $derived(activePin !== undefined ? activePin : (localPin ?? null));
  const active = $derived(pinIndex !== null ? -1 : (localActive ?? activeIndex));

  let root: HTMLDivElement;
  let barTop = $state<number | null>(null);

  // the accent bar slides to whichever row is active
  async function syncBar() {
    await tick();
    const row = root.querySelector('[data-active-row]');
    barTop = row ? Math.round(row.getBoundingClientRect().top - root.getBoundingClientRect().top) + 7 : null;
  }

  $effect(() => {
    void active;
    void pinIndex;
    void open;
    void exploreActive;
    void guest;
    void items;
    void pins;
    syncBar();
  });

  function overlaying() {
    const slot = root.closest('[data-rail-slot]');
    return !!(open && slot && slot.getBoundingClientRect().width < 200);
  }

  function picked() {
    if (overlaying()) open = false;
  }

  onMount(() => {
    const away = (e: PointerEvent) => {
      if (overlaying() && !root.contains(e.target as Node)) open = false;
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  const chitTitle = $derived(
    chitClaimable ? t('ui.navRail.chitClaim', { streak: chitStreak }) : t('ui.navRail.chitClaimed', { streak: chitStreak, puzzle: puzzleDue ? 'yes' : 'no' }),
  );
</script>

<div class="rail" class:open bind:this={root} data-rail-expanded={open ? 'true' : 'false'}>
  <span class="bar" style:top="{barTop ?? 13}px" style:opacity={barTop === null ? 0 : 1}></span>
  {#if !guest}
    {#each items as item, i}
      <div
        class="row"
        class:active={i === active}
        data-active-row={i === active ? '' : undefined}
        onclick={() => {
          picked();
          localActive = i;
          localPin = null;
          onSelect?.(i);
        }}
        role="button"
        tabindex="0"
        aria-label={t('ui.navRail.itemLabel', { name: t(item.label || NAMES[item.icon] || item.icon), count: item.count ?? 0 })}
      >
        <span class="item-icon" style:mask="var(--icon-{ICONS[item.icon] ?? ICONS.messages}) center/contain no-repeat"></span>
        <span class="label fold">{item.label ? t(item.label) : ''}</span>
        {#if item.dot}
          <span class="badge-slot"><span class="count">{item.count ?? ''}</span></span>
          <span class="dot"></span>
        {/if}
      </div>
    {/each}
  {/if}

  {#if guest}
    <a class="row" href={homeHref} data-home="" title={t('ui.navRail.backHome')}>
      <span class="slot"><span class="home-icon"></span></span>
      <span class="label muted">{t('ui.navRail.home')}</span>
    </a>
  {/if}
  <div class="heading">
    <span class="heading-label">{t('ui.navRail.communities')}</span>
    <div class="heading-line"></div>
  </div>
  <div class="pins">
    {#each pins as pin, i}
      {@const selected = i === pinIndex}
      <div
        class="row"
        class:active={selected}
        data-active-row={selected ? '' : undefined}
        onclick={() => {
          picked();
          localPin = i;
          onSelectPin?.(i);
        }}
        role="button"
        tabindex="0"
        aria-label={pin.label ? t(pin.label) : pin.name || t('ui.navRail.communityN', { n: i + 1 })}
        aria-current={selected ? 'page' : undefined}
      >
        <span class="slot">
          <span class="pin" class:selected class:preview={selected && pin.preview} style:background={GRADIENTS[pin.color] ?? GRADIENTS.blue}>
            {#if selected && pin.preview}
              <span class="pin-veil"></span>
              <span class="pin-eye" title={t('ui.navRail.previewing')}><span class="pin-eye-icon"></span></span>
            {/if}
            {#if pin.dot}
              <span class="pin-dot"></span>
            {/if}
          </span>
        </span>
        <span class="label">{pin.name ?? t('ui.navRail.community')}{#if selected && pin.preview}<span class="preview-tag"> {t('ui.navRail.previewTag')}</span>{/if}</span>
      </div>
    {/each}
    {#if !guest}
      <div class="row" onclick={() => onCreateCommunity?.()} role="button" tabindex="0" aria-label={t('ui.navRail.createCommunity')} title={t('ui.navRail.createCommunity')}>
        <span class="slot"><span class="create"><span class="create-icon"></span></span></span>
        <span class="label muted">{t('ui.navRail.create')}</span>
      </div>
    {/if}
    <div
      class="row explore"
      class:on={exploreActive}
      onclick={() => onExplore?.()}
      role="button"
      tabindex="0"
      aria-label={t('ui.navRail.exploreCommunities')}
      title={t('ui.navRail.exploreCommunities')}
      data-active-row={exploreActive ? '' : undefined}
    >
      <span class="slot centered"><span class="explore-icon"></span></span>
      <span class="label explore-label">{t('ui.navRail.explore')}</span>
    </div>
  </div>

  <div class="grow"></div>

  <!-- CHIT is a personal action, so it never takes the destination highlight -->
  {#if chitShown && !guest}
    <div class="row chit" class:claimable={chitClaimable} onclick={() => onChit?.()} role="button" tabindex="0" aria-label={chitTitle} title={chitTitle}>
      <span class="chit-slot">
        <span class="chit-icon"></span>
        <span class="chit-dot" style:opacity={(chitClaimable || puzzleDue) && !open ? 1 : 0}></span>
      </span>
      <span class="label fold">CHIT</span>
      <span class="badge-slot"><span class="streak">{chitStreak}</span></span>
    </div>
  {/if}

  {#if guest}
    <div class="row sign-in" onclick={() => onSignIn?.()} aria-label={t('ui.navRail.signIn')} role="button" tabindex="0" title={t('ui.navRail.signIn')}>
      <span class="key-slot"><span class="key-icon"></span></span>
      <span class="label sign-in-label">{t('ui.navRail.signIn')}</span>
    </div>
  {:else}
    <div class="row profile" onclick={() => onProfile?.()} role="button" tabindex="0">
      <span class="slot tall">
        <span class="me"><span class="me-online"></span></span>
      </span>
      <div class="profile-text">
        <span class="profile-name">{profileLabel}</span>
        <span class="profile-handle">{profileHandle}</span>
      </div>
    </div>
  {/if}

  <div class="row collapse" onclick={() => (open = !open)} role="button" tabindex="0">
    <span class="collapse-icon"></span>
    <span class="label collapse-label">{t('ui.navRail.collapse')}</span>
  </div>
</div>

<style>
  .rail {
    position: relative;
    height: 100%;
    min-height: 560px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-8) var(--space-2);
    gap: var(--space-6);
    width: 60px;
    transition: width var(--duration-slow) var(--ease-out);
  }

  .rail.open {
    width: 283px;
  }

  .bar {
    position: absolute;
    inset-inline-start: 0;
    width: 3px;
    height: 28px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    z-index: 2;
    pointer-events: none;
    transition:
      top 0.3s var(--ease-out),
      opacity var(--duration-base) ease;
  }

  .row {
    position: relative;
    z-index: 1;
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-26);
    height: 42px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    text-decoration: none;
    cursor: pointer;
  }

  .row:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
  }

  .row.active,
  .row.active:hover,
  .explore.on {
    background: var(--accent-soft, rgba(255, 86, 114, 0.07));
  }

  .explore.on:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
  }

  .item-icon {
    flex: none;
    width: 20px;
    height: 20px;
    background: var(--ink-3, #7c7c8c);
  }

  .active .item-icon {
    background: var(--accent-bright, #ff8298);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transition: opacity var(--duration-base) ease;
  }

  .open .label {
    opacity: 1;
  }

  .label.fold {
    max-width: 0px;
    transition:
      max-width var(--duration-slow) var(--ease-out),
      opacity var(--duration-base) ease;
  }

  .open .label.fold {
    max-width: 207px;
  }

  .active .label {
    font-weight: var(--weight-semibold);
    color: var(--ink, #ececf1);
  }

  .label.muted {
    color: var(--ink-3, #8a8a99);
  }

  .badge-slot {
    flex: none;
    overflow: hidden;
    display: flex;
    max-width: 0px;
    transition: max-width var(--duration-slow) var(--ease-out);
  }

  .open .badge-slot {
    max-width: 48px;
  }

  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
  }

  .dot {
    position: absolute;
    top: 4px;
    inset-inline-start: 32px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    box-shadow: 0 0 0 2.5px var(--bg, #07070a);
    opacity: 1;
    transition: opacity var(--duration-base) ease;
  }

  .active .dot {
    width: 7px;
    height: 7px;
  }

  .open .dot {
    opacity: 0;
  }

  .slot {
    position: relative;
    flex: none;
    width: 20px;
    height: 34px;
  }

  .slot.centered,
  a .slot {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slot.tall {
    height: 38px;
  }

  .home-icon {
    width: 21px;
    height: 21px;
    background: var(--ink-3, #7c7c8c);
    mask: var(--icon-home) center/contain no-repeat;
  }

  .heading {
    position: relative;
    z-index: 1;
    flex: none;
    display: flex;
    align-items: center;
    gap: 0;
    padding: var(--space-24) var(--space-12);
    overflow: hidden;
  }

  .heading-label {
    flex: 0 1 auto;
    box-sizing: border-box;
    padding-inline-end: 0;
    min-width: 0;
    max-width: 0px;
    overflow: hidden;
    white-space: nowrap;
    font: var(--weight-medium) var(--text-2xs) / 1 var(--font-mono);
    letter-spacing: 0.06em;
    color: var(--ink-4, #6e6e7c);
    opacity: 0;
    transition:
      max-width var(--duration-slow) var(--ease-out),
      opacity var(--duration-base) ease;
  }

  .open .heading-label {
    max-width: 207px;
    opacity: 1;
  }

  .heading-line {
    flex: 1;
    min-width: 34px;
    margin-inline-start: -7px;
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line-2, rgba(255, 255, 255, 0.12));
    transition: margin-inline-start var(--duration-slow) var(--ease-out);
  }

  .open .heading-line {
    margin-inline-start: 10px;
  }

  .pins {
    position: relative;
    z-index: 1;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .pins .row {
    z-index: auto;
  }

  .pin,
  .create,
  .me {
    position: absolute;
    top: 0;
    inset-inline-start: 50%;
    /* --oc-dir is -1 under dir="rtl", where inset-inline-start measures from the right */
    transform: translateX(calc(-50% * var(--oc-dir, 1)));
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
  }

  .pin:not(.selected):hover {
    box-shadow:
      0 0 0 2px var(--bg, #07070a),
      0 0 0 4px var(--line-2, rgba(255, 255, 255, 0.18));
  }

  .pin.selected {
    box-shadow:
      0 0 0 2px var(--bg, #07070a),
      0 0 0 4px var(--accent, #ff5672);
    outline: none;
    outline-offset: 3px;
  }

  .pin.preview {
    box-shadow: none;
    outline: 1.5px dashed var(--accent, #ff5672);
  }

  .pin-veil {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgba(7, 7, 10, 0.45);
  }

  .pin-eye {
    position: absolute;
    inset-inline-end: -6px;
    bottom: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--surface-2, #191921);
    box-shadow: 0 0 0 2px var(--bg, #07070a);
  }

  .pin-eye-icon {
    width: 11px;
    height: 11px;
    background: var(--ink, #ececf1);
    mask: var(--icon-eye) center/contain no-repeat;
  }

  .pin-dot {
    position: absolute;
    top: -5px;
    inset-inline-start: 28px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    border: 4px solid var(--bg, #07070a);
  }

  .preview-tag {
    font-weight: var(--weight-medium);
    color: var(--ink-4, #7c7c8c);
  }

  .create {
    box-sizing: border-box;
    border: 1.5px dashed var(--line-3, rgba(255, 255, 255, 0.24));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .create-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #8a8a99);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .explore-icon {
    width: 22px;
    height: 22px;
    background: var(--ink-3, #7c7c8c);
    mask: var(--icon-compass) center/contain no-repeat;
  }

  .explore.on .explore-icon {
    background: var(--accent, #ff5672);
  }

  .explore-label {
    color: var(--ink-3, #8a8a99);
  }

  .explore.on .explore-label {
    color: var(--ink, #ececf1);
  }

  .grow {
    flex: 1;
  }

  .chit {
    margin-block-end: var(--space-4);
    overflow: hidden;
  }

  .chit-slot {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .chit-icon {
    width: 19px;
    height: 19px;
    background: var(--ink-3, #7c7c8c);
    mask: var(--icon-zap) center/contain no-repeat;
  }

  .claimable .chit-icon {
    background: var(--status-chit, #ff9f45);
  }

  .chit-dot {
    position: absolute;
    top: -2px;
    inset-inline-end: -4px;
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
    box-shadow: 0 0 0 2.5px var(--bg, #07070a);
  }

  .chit .label.fold {
    transition: opacity var(--duration-base) ease;
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0 var(--space-6);
    height: 20px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
    white-space: nowrap;
  }

  .claimable .streak {
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.16));
    color: var(--status-chit, #ff9f45);
  }

  .sign-in {
    height: 46px;
    margin-block-end: var(--space-4);
    background: var(--accent, #ff5672);
    overflow: hidden;
  }

  .sign-in:hover {
    background: var(--accent, #ff5672);
    filter: brightness(1.08);
  }

  .key-slot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .key-icon {
    width: 18px;
    height: 18px;
    background: var(--on-accent, #2e0512);
    mask: var(--icon-key) center/contain no-repeat;
  }

  .sign-in-label {
    font-weight: var(--weight-semibold);
    color: var(--on-accent, #2e0512);
    overflow: visible;
  }

  .profile {
    height: 54px;
  }

  .me {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-pill);
    background: linear-gradient(140deg, #ff5f9e, #6a2bff);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .me-online {
    position: absolute;
    top: 26px;
    inset-inline-start: 28px;
    width: 11px;
    height: 11px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    border: 2.5px solid var(--bg, #07070a);
  }

  .profile-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow: hidden;
    opacity: 0;
    transition: opacity var(--duration-base) ease;
  }

  .open .profile-text {
    opacity: 1;
  }

  .profile-name,
  .profile-handle {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-name {
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .profile-handle {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #6e6e7c);
  }

  .collapse {
    height: 38px;
    margin-bottom: 4px;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .collapse-icon {
    flex: none;
    width: 20px;
    height: 20px;
    background: var(--ink-4, #5f5f6c);
    mask: var(--icon-chevrons-right) center/contain no-repeat;
    transform: scaleX(var(--oc-dir, 1));
    transition: transform var(--duration-slow) var(--ease-out);
  }

  .open .collapse-icon {
    transform: scaleX(var(--oc-dir, 1)) rotate(180deg);
  }

  .collapse-label {
    font-size: var(--text-md);
    color: var(--ink-4, #6e6e7c);
  }
</style>
