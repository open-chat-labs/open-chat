<!-- Generated from lib/NavRail.dc.html (source hash 42bdb472) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './NavRail.logic.js';

  interface Props {
    puzzleDue?: boolean;
    expanded?: boolean;
    activeIndex?: number;
    activePin?: number | null;
    profileLabel?: string;
    profileHandle?: string;
    items?: {icon: string, label?: string, dot?: boolean, count?: number}[];
    pins?: {color: string, name?: string, dot?: boolean}[];
    onSelect?: (i: number) => void;
    exploreActive?: boolean;
    onExplore?: () => void;
    guest?: boolean;
    onSignIn?: () => void;
    onCreateCommunity?: () => void;
    onSelectPin?: (i: number) => void;
    chitShown?: boolean;
    chitStreak?: number;
    chitClaimable?: boolean;
    onChit?: () => void;
    onProfile?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;height:100%;min-height:560px;box-sizing:border-box;display:flex;flex-direction:column;padding:var(--space-6) var(--space-8) var(--space-2);gap:var(--space-6);width:{v.railWidth};transition:width var(--duration-slow) var(--ease-out)" use:ref={v.rootRef} data-rail-expanded={v.expandedAttr}>
  <span style="position:absolute;inset-inline-start:0;width:3px;height:28px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);z-index:2;pointer-events:none;top:{v.barTop};opacity:{v.barOpacity};transition:top .3s var(--ease-out),opacity var(--duration-base) ease"></span>
  {#if v.notGuest}
  {#each v.items ?? [] as item, i0}
    {#if item.active}
      <div style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--accent-soft,rgba(255,86,114,.07));cursor:pointer" data-active-row="" onclick={item.onPress} role="button" tabindex="0" aria-label={item.ariaLabel} aria-current={item.ariaCurrent}>
        <span style="flex:none;width:20px;height:20px;background:var(--accent-bright,#FF8298);mask:{item.maskCss}"></span>
        <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:{v.labelMax};opacity:{v.labelOpacity};transition:max-width var(--duration-slow) var(--ease-out),opacity var(--duration-base) ease">{t(item.label)}</span>
        {#if item.dot}
          <span style="flex:none;overflow:hidden;display:flex;max-width:{v.badgeMax};transition:max-width var(--duration-slow) var(--ease-out)">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 var(--space-4);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold) var(--text-xs)/1 var(--font-sans)">{t(item.count)}</span>
          </span>
          <span style="position:absolute;top:4px;left:32px;width:7px;height:7px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);box-shadow:0 0 0 2.5px var(--bg,#07070a);opacity:{v.dotOpacity};transition:opacity var(--duration-base) ease"></span>
        {/if}
      </div>
    {/if}
    {#if item.idle}
      <div class="dc-p0" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);cursor:pointer" onclick={item.onPress} role="button" tabindex="0" aria-label={item.ariaLabel} aria-current={item.ariaCurrent}>
        <span style="flex:none;width:20px;height:20px;background:var(--ink-3,#7C7C8C);mask:{item.maskCss}"></span>
        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink-2,#B9B9C6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:{v.labelMax};opacity:{v.labelOpacity};transition:max-width var(--duration-slow) var(--ease-out),opacity var(--duration-base) ease">{t(item.label)}</span>
        {#if item.dot}
          <span style="flex:none;overflow:hidden;display:flex;max-width:{v.badgeMax};transition:max-width var(--duration-slow) var(--ease-out)">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 var(--space-4);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold) var(--text-xs)/1 var(--font-sans)">{t(item.count)}</span>
          </span>
          <span style="position:absolute;top:4px;left:32px;width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);box-shadow:0 0 0 2.5px var(--bg,#07070a);opacity:{v.dotOpacity};transition:opacity var(--duration-base) ease"></span>
        {/if}
      </div>
    {/if}
  {/each}
  {/if}

    {#if v.isGuest}
      <a class="dc-p1" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);text-decoration:none;cursor:pointer" href={v.homeHref} data-home="" title="Back to oc.app">
        <span style="position:relative;flex:none;width:20px;height:34px;display:flex;align-items:center;justify-content:center"><span style="width:21px;height:21px;background:var(--ink-3,#7C7C8C);mask:{v.homeMask}"></span></span>
        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink-3,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">Home</span>
      </a>
    {/if}
    <div style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:0;padding:var(--space-24) var(--space-12);overflow:hidden">
      <span style="flex:0 1 auto;box-sizing:border-box;padding-inline-end:0;min-width:0;max-width:{v.labelMax};overflow:hidden;white-space:nowrap;font:var(--weight-medium) var(--text-2xs)/1 var(--font-mono);letter-spacing:.06em;color:var(--ink-4,#6E6E7C);opacity:{v.labelOpacity};transition:max-width var(--duration-slow) var(--ease-out),opacity var(--duration-base) ease">COMMUNITIES</span>
      <div style="flex:1;min-width:34px;margin-inline-start:{v.pillOffset};height:3px;border-radius:var(--radius-pill);background:var(--line-2,rgba(255,255,255,.12));transition:margin-left var(--duration-slow) var(--ease-out)"></div>
    </div>
    <div style="position:relative;z-index:1;flex:none;display:flex;flex-direction:column;gap:var(--space-14)">
      {#each v.pins ?? [] as pin, i1}
        {#if pin.selected}
          <div style="position:relative;display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--accent-soft,rgba(255,86,114,.07));cursor:pointer" data-active-row="" onclick={pin.onPress} role="button" tabindex="0" aria-label={pin.ariaLabel} aria-current={pin.ariaCurrent}>
            <span style="position:relative;flex:none;width:20px;height:34px">
              <span style="position:absolute;top:0;inset-inline-start:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:var(--radius-md);background:{pin.gradient};box-shadow:{pin.ring};outline:{pin.outline};outline-offset:3px">
                {#if pin.preview}
                  <span style="position:absolute;inset:0;border-radius:inherit;background:rgba(7,7,10,.45)"></span>
                  <span style="position:absolute;right:-6px;bottom:-6px;display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:var(--radius-pill);background:var(--surface-2,#191921);box-shadow:0 0 0 2px var(--bg,#07070a)" title="Previewing"><span style="width:11px;height:11px;background:var(--ink,#ECECF1);mask:{v.eyeMask}"></span></span>
                {/if}
                {#if pin.dot}
                  <span style="position:absolute;top:-5px;left:28px;width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);border:4px solid var(--bg,#07070a)"></span>
                {/if}
              </span>
            </span>
            <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">{t(pin.name)}{#if pin.preview}<span style="font-weight:var(--weight-medium);color:var(--ink-4,#7C7C8C)"> · Preview</span>{/if}</span>
          </div>
        {/if}
        {#if pin.idle}
          <div class="dc-p2" style="position:relative;display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);cursor:pointer" onclick={pin.onPress} role="button" tabindex="0" aria-label={pin.ariaLabel} aria-current={pin.ariaCurrent}>
            <span style="position:relative;flex:none;width:20px;height:34px">
              <span class="dc-p3" style="position:absolute;top:0;inset-inline-start:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:var(--radius-md);background:{pin.gradient}">
                {#if pin.dot}
                  <span style="position:absolute;top:-5px;left:28px;width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);border:4px solid var(--bg,#07070a)"></span>
                {/if}
              </span>
            </span>
            <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink-2,#B9B9C6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">{t(pin.name)}</span>
          </div>
        {/if}
      {/each}
      {#if v.notGuest}
      <div class="dc-p4" style="display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);cursor:pointer" onclick={v.onCreateCommunity} role="button" tabindex="0" aria-label="Create a community" title="Create a community">
        <span style="position:relative;flex:none;width:20px;height:34px">
          <span style="position:absolute;top:0;inset-inline-start:50%;transform:translateX(-50%);width:34px;height:34px;box-sizing:border-box;border-radius:var(--radius-md);border:1.5px dashed var(--line-3,rgba(255,255,255,.24));display:flex;align-items:center;justify-content:center">
            <span style="width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{v.plusMask}"></span>
          </span>
        </span>
        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink-3,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">Create community</span>
      </div>
      {/if}
      <div class="dc-p5" style="display:flex;align-items:center;gap:var(--space-26);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);background:{v.exploreBg};cursor:pointer" onclick={v.onExplore} role="button" tabindex="0" aria-label="Explore communities" title="Explore communities" data-active-row={v.exploreActiveAttr}>
        <span style="position:relative;flex:none;width:20px;height:34px;display:flex;align-items:center;justify-content:center">
          <span style="width:22px;height:22px;background:{v.exploreInk};mask:var(--icon-compass) center/contain no-repeat"></span>
        </span>
        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:{v.exploreLabelInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">Explore Communities</span>
      </div>
    </div>

  <div style="flex:1"></div>

  {#if v.chitShown}
    <div class="dc-p6" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:42px;margin-block-end:var(--space-4);padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);cursor:pointer;overflow:hidden" onclick={v.onChit} role="button" tabindex="0" aria-label={v.chitTitle} title={v.chitTitle}>
      <span style="position:relative;flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px">
        <span style="width:19px;height:19px;background:{v.chitInk};mask:{v.chitMask}"></span>
        <span style="position:absolute;top:-2px;right:-4px;width:7px;height:7px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);box-shadow:0 0 0 2.5px var(--bg,#07070a);opacity:{v.chitDotOpacity}"></span>
      </span>
      <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink-2,#B9B9C6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:{v.labelMax};opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">CHIT</span>
      <span style="flex:none;overflow:hidden;display:flex;max-width:{v.badgeMax};transition:max-width var(--duration-slow) var(--ease-out)">
        <span style="display:inline-flex;align-items:center;gap:3px;padding:0 var(--space-6);height:20px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.chitPillBg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);color:{v.chitPillInk};white-space:nowrap">{t(v.chitStreak)}</span>
      </span>
    </div>
  {/if}

  {#if v.isGuest}
    <div class="dc-p7" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:46px;margin-block-end:var(--space-4);padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--accent,#FF5672);cursor:pointer;overflow:hidden" onclick={v.onSignIn} aria-label="Sign in" role="button" tabindex="0" title="Sign in">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px"><span style="width:18px;height:18px;background:var(--on-accent,#2E0512);mask:{v.keyMask}"></span></span>
      <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512);white-space:nowrap;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">Sign in</span>
    </div>
  {/if}
  {#if v.notGuest}
  <div class="dc-p8" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:54px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-lg);cursor:pointer" onclick={v.onProfile} role="button" tabindex="0">
    <span style="position:relative;flex:none;width:20px;height:38px">
      <span style="position:absolute;top:0;inset-inline-start:50%;transform:translateX(-50%);width:38px;height:38px;border-radius:var(--radius-pill);background:linear-gradient(140deg,#ff5f9e,#6a2bff);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))">
        <span style="position:absolute;top:26px;left:28px;width:11px;height:11px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);border:2.5px solid var(--bg,#07070a)"></span>
      </span>
    </span>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4);overflow:hidden;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">
      <span style="font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.profileLabel)}</span>
      <span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#6E6E7C);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.profileHandle)}</span>
    </div>
  </div>
  {/if}

  <div class="dc-p9" style="position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:var(--space-26);height:38px;margin-bottom:4px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-sm);overflow:hidden;cursor:pointer" onclick={v.toggleExpanded} role="button" tabindex="0">
    <span style="flex:none;width:20px;height:20px;background:var(--ink-4,#5F5F6C);transform:{v.chevronTransform};transition:transform var(--duration-slow) var(--ease-out);mask:var(--icon-chevrons-right) center/contain no-repeat"></span>
    <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-4,#6E6E7C);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:{v.labelOpacity};transition:opacity var(--duration-base) ease">Collapse</span>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p3:hover{box-shadow:0 0 0 2px var(--bg,#07070a),0 0 0 4px var(--line-2,rgba(255,255,255,.18)) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p5:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p7:hover{filter:brightness(1.08) !important}
  .dc-p8:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
  .dc-p9:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
</style>
