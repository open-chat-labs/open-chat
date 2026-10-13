<!-- Generated from lib/ExploreCommunities.dc.html (source hash 8685dae7) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ExploreCommunities.logic.js';

  interface Props {
    onCreateAccount?: () => void;
    communities?: any[];
    joinedKeys?: string[];
    onOpen?: (key: string) => void;
    onJoin?: (key: string) => void;
    guest?: boolean;
    onSignIn?: () => void;
    onCreate?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;overflow-y:auto;overflow-x:hidden" data-screen-label="Explore communities">

  {#if v.isSearching}
    <div style="position:sticky;top:0;z-index:5;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-18) var(--space-32) var(--space-14);background:var(--surface-1,#0e0e12);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07));animation:ex-bar-in 320ms cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:var(--space-14)">
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:36px;padding:0 var(--space-10);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8);cursor:pointer;user-select:none" onclick={v.onClearQuery} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.backMask}"></span>Explore</span>
        <div style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-10);height:46px;padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.06));box-shadow:inset 0 0 0 1px {v.searchRing}">
          <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.searchMask}"></span>
          <input style="flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.query} oninput={v.onQuery} onfocus={v.onFocus} onblur={v.onBlur} autofocus={true} placeholder="Search by name or description">
          <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--radius-pill);cursor:pointer" onclick={v.onClearQuery} aria-label="Clear" role="button" tabindex="0" title="Clear"><span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span></span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-8);flex-wrap:wrap">
        <span style="flex:1 1 auto;padding-inline-start:calc(var(--space-10) + 21px);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.resultCountLabel)}</span>
        <div style="position:relative;flex:none" data-ex-lang="">
          <span style="display:flex;align-items:center;gap:var(--space-6);height:32px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-pill);background:{v.langBtnBg};box-shadow:inset 0 0 0 1px {v.langBtnLine};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{v.langBtnInk};cursor:pointer;user-select:none;white-space:nowrap" onclick={v.toggleLang} role="button" tabindex="0">{t(v.langBtnLabel)}<span style="width:12px;height:12px;background:currentColor;mask:{v.chevMask}"></span></span>
          {#if v.langOpen}
            <div style="position:fixed;inset:0;z-index:19" onclick={v.closeLang}></div>
            <div style="position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:20;width:220px;display:flex;flex-direction:column;gap:2px;padding:var(--space-6);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.35))">
              {#each v.langOptions ?? [] as l, i0}
                <div class="dc-p2" style="display:flex;align-items:center;gap:var(--space-10);min-height:38px;padding:0 var(--space-10);border-radius:var(--radius-sm);cursor:pointer;user-select:none" onclick={l.toggle} tabindex="0" role="option">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:18px;height:18px;box-sizing:border-box;border-radius:5px;background:{l.boxBg};box-shadow:inset 0 0 0 1.5px {l.boxLine}"><span style="width:11px;height:11px;background:var(--on-accent,#2E0512);mask:{v.checkMask};opacity:{l.checkOpacity}"></span></span>
                  <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(l.label)}</span>
                  <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(l.count)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:center;padding:var(--space-22) var(--space-32) var(--space-32)">
      <div style="width:100%;max-width:1080px;display:flex;flex-direction:column;gap:var(--space-18);animation:ex-rise 380ms 80ms cubic-bezier(.2,.8,.2,1) both">
        {#if v.hasBest}
          <div class="dc-p3" style="display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);min-height:240px;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-2,#141419);border:1px solid var(--line-2,rgba(255,255,255,.09));overflow:hidden;cursor:{v.best.cursor}" onclick={v.best.open} role="button" tabindex="0">
            <span style="background:{v.best.cover}"></span>
            <div style="min-width:0;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-22) var(--space-24)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--status-chit,#FFB03D)">BEST MATCH</span>
              <div style="display:flex;align-items:center;gap:var(--space-14);min-width:0">
                <span style="flex:none;width:54px;height:54px;border-radius:18px;background:{v.best.avatar}"></span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
                  <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0"><span style="min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.best.name)}</span>{#if v.best.verified}<span style="flex:none;width:16px;height:16px;background:var(--status-verified,#3D9BFF);mask:{v.verifiedMask}"></span>{/if}</div>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.best.meta)}</span>
                </div>
              </div>
              <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden">{t(v.best.about)}</span>
              <span style="font:var(--weight-medium) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.best.channelList)}</span>
              <div style="display:flex;align-items:center;gap:var(--space-10);margin-top:auto;flex-wrap:wrap">
                {#if v.best.canPreview}
                  <span style="display:flex;align-items:center;gap:var(--space-6);height:38px;padding:0 var(--space-16);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512)"><span style="width:15px;height:15px;background:var(--on-accent,#2E0512);mask:{v.eyeMask}"></span>{t(v.best.cta)}</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.best.ctaHint)}</span>
                {/if}
                {#if v.best.inviteOnly}
                  <span style="display:flex;align-items:center;gap:var(--space-6);height:32px;padding:0 var(--space-12);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.lockMask}"></span>Invite only — join with an invite link</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if v.hasRest}
          <span style="padding-inline:var(--space-4);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">MORE RESULTS</span>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-16)">
            {#each v.restCards ?? [] as c, i1}
              <div class="dc-p4" style="display:flex;flex-direction:column;min-width:0;border-radius:var(--radius-lg);background:var(--surface-2,#141419);box-sizing:border-box;border:1px solid var(--line-1,rgba(255,255,255,.07));overflow:hidden;cursor:{c.cursor}" onclick={c.open} role="button" tabindex="0">
                <span style="flex:none;height:120px;background:{c.cover}"></span>
                <div style="flex:1;display:flex;flex-direction:column;gap:var(--space-10);padding:0 var(--space-16) var(--space-16)">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-10)">
                    <span style="flex:none;width:60px;height:60px;box-sizing:border-box;margin-top:-30px;border-radius:20px;border:4px solid var(--surface-2,#141419);background:{c.avatar}"></span>
                    {#if c.hasTag}
                      <span style="margin-top:var(--space-10);display:flex;align-items:center;gap:var(--space-4);height:24px;padding:0 var(--space-10);border-radius:var(--radius-pill);background:{c.tagBg};font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:{c.tagInk}"><span style="width:11px;height:11px;background:currentColor;mask:{c.tagMask}"></span>{t(c.tag)}</span>
                    {/if}
                  </div>
                  <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0"><span style="min-width:0;font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.name)}</span>{#if c.verified}<span style="flex:none;width:15px;height:15px;background:var(--status-verified,#3D9BFF);mask:{v.verifiedMask}"></span>{/if}</div>
                  <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:3em;margin-bottom:var(--space-10);text-wrap:pretty">{t(c.about)}</span>
                  <div style="display:flex;align-items:center;gap:var(--space-12);min-height:52px;margin:auto calc(var(--space-16) * -1) calc(var(--space-16) * -1);padding:0 var(--space-16);box-sizing:border-box;border-top:1px solid var(--line-1,rgba(255,255,255,.07));background:var(--overlay-1,rgba(255,255,255,.02));font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">
                    <span style="display:flex;align-items:center;gap:var(--space-6)" title="{c.members} members"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.usersMask}"></span>{t(c.members)}</span><span style="display:flex;align-items:center;gap:var(--space-6)" title="{c.channels} channels"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.hashMask}"></span>{t(c.channels)}</span><span style="flex:1"></span>
                    <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{c.ctaInk}">{t(c.cardCta)}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if v.empty}
          <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);padding:var(--space-32) var(--space-18);text-align:center">
            <span style="font:var(--weight-semibold) var(--text-lg)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.emptyTitle)}</span>
            <span style="max-width:380px;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Try another search or language, or start the community you were looking for.</span>
            <span class="dc-p5" style="display:flex;align-items:center;gap:var(--space-8);height:38px;margin-top:var(--space-6);padding:0 var(--space-16);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onCreate} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--on-accent,#2E0512);mask:{v.plusMask}"></span>Create community</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if v.notSearching}
  <div style="position:relative;z-index:4;animation:ex-hero-in 300ms cubic-bezier(.2,.8,.2,1) both;display:flex;flex-direction:column;align-items:center;gap:var(--space-24);padding:56px var(--space-32) var(--space-26);background:radial-gradient(ellipse 70% 100% at 50% 0%,color-mix(in oklch,var(--accent,#FF5672) 10%,transparent),transparent 70%)">
    <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);text-align:center">
      <span style="font:var(--weight-bold) 34px/1.15 var(--font-sans);letter-spacing:-.02em;color:var(--ink,#ECECF1);text-wrap:balance">Explore communities. Find your people!</span>
      <span style="font:var(--weight-regular) var(--text-base)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.heroSub)}</span>
    </div>
    <div style="width:100%;max-width:640px;display:flex;align-items:center;gap:var(--space-12);height:56px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-xl);background:var(--overlay-1,rgba(255,255,255,.06));box-shadow:inset 0 0 0 1px {v.searchRing},0 10px 30px rgba(0,0,0,.3)">
      <span style="flex:none;width:18px;height:18px;background:var(--ink-3,#9A9AA8);mask:{v.searchMask}"></span>
      <input style="flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:var(--weight-medium) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.query} oninput={v.onQuery} onfocus={v.onFocus} onblur={v.onBlur} placeholder="Search by name or description">
      {#if v.hasQuery}
        <span class="dc-p6" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-pill);cursor:pointer" onclick={v.onClearQuery} aria-label="Clear" role="button" tabindex="0" title="Clear"><span style="width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span></span>
      {/if}
    </div>
    <div style="display:flex;align-items:center;gap:var(--space-10);flex-wrap:wrap;justify-content:center">
      <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">Showing communities in</span>
      <div style="position:relative;flex:none" data-ex-lang="">
        <span style="display:flex;align-items:center;gap:var(--space-6);height:36px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:{v.langBtnBg};box-shadow:inset 0 0 0 1px {v.langBtnLine};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{v.langBtnInk};cursor:pointer;user-select:none;white-space:nowrap" onclick={v.toggleLang} role="button" tabindex="0">{t(v.langBtnLabel)}<span style="width:12px;height:12px;background:currentColor;mask:{v.chevMask}"></span></span>
        {#if v.langOpen}
          <div style="position:fixed;inset:0;z-index:19" onclick={v.closeLang}></div>
          <div style="position:absolute;inset-inline-start:50%;transform:translateX(-50%);top:calc(100% + 6px);z-index:20;width:220px;display:flex;flex-direction:column;gap:2px;padding:var(--space-6);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.35))">
            {#each v.langOptions ?? [] as l, i2}
              <div class="dc-p7" style="display:flex;align-items:center;gap:var(--space-10);min-height:38px;padding:0 var(--space-10);border-radius:var(--radius-sm);cursor:pointer;user-select:none" onclick={l.toggle} tabindex="0" role="option">
                <span style="flex:none;display:flex;align-items:center;justify-content:center;width:18px;height:18px;box-sizing:border-box;border-radius:5px;background:{l.boxBg};box-shadow:inset 0 0 0 1.5px {l.boxLine}"><span style="width:11px;height:11px;background:var(--on-accent,#2E0512);mask:{v.checkMask};opacity:{l.checkOpacity}"></span></span>
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(l.label)}</span>
                <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(l.count)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <span style="width:1px;height:16px;background:var(--line-2,rgba(255,255,255,.12))"></span>
      <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">or <span style="font-weight:var(--weight-semibold);color:var(--accent,#FF5672);cursor:pointer" onclick={v.onCreate} role="button" tabindex="0">create your own community</span></span>
    </div>
  </div>

  {#if v.hasPopular}
    <div style="display:flex;justify-content:center;padding:0 var(--space-32) var(--space-26);animation:ex-rise 380ms 60ms cubic-bezier(.2,.8,.2,1) both">
      <div style="width:100%;max-width:1000px;display:flex;flex-direction:column;gap:var(--space-14)">
        <div style="display:flex;align-items:baseline;gap:var(--space-10);padding-inline:var(--space-4)">
          <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.popularTitle)}</span>
          <span style="flex:none;font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.popularSub)}</span>
        </div>
                {#if v.hasFeatured}
          <div class="dc-p8" style="display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);min-height:240px;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-2,#141419);border:1px solid var(--line-2,rgba(255,255,255,.09));overflow:hidden;cursor:{v.featured.cursor}" onclick={v.featured.open} role="button" tabindex="0">
            <span style="background:{v.featured.cover}"></span>
            <div style="min-width:0;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-22) var(--space-24)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--status-chit,#FFB03D)">FEATURED · MOST MEMBERS</span>
              <div style="display:flex;align-items:center;gap:var(--space-14);min-width:0">
                <span style="flex:none;width:54px;height:54px;border-radius:18px;background:{v.featured.avatar}"></span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
                  <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0"><span style="min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.featured.name)}</span>{#if v.featured.verified}<span style="flex:none;width:16px;height:16px;background:var(--status-verified,#3D9BFF);mask:{v.verifiedMask}"></span>{/if}</div>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.featured.meta)}</span>
                </div>
              </div>
              <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden">{t(v.featured.about)}</span>
              <span style="font:var(--weight-medium) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.featured.channelList)}</span>
              <div style="display:flex;align-items:center;gap:var(--space-10);margin-top:auto;flex-wrap:wrap">
                {#if v.featured.canPreview}
                  <span style="display:flex;align-items:center;gap:var(--space-6);height:38px;padding:0 var(--space-16);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512)"><span style="width:15px;height:15px;background:var(--on-accent,#2E0512);mask:{v.eyeMask}"></span>{t(v.featured.cta)}</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.featured.ctaHint)}</span>
                {/if}
                {#if v.featured.inviteOnly}
                  <span style="display:flex;align-items:center;gap:var(--space-6);height:32px;padding:0 var(--space-12);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.lockMask}"></span>Invite only — join with an invite link</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        <div style="container-type:inline-size;display:grid;grid-template-columns:minmax(0,1fr)" data-ex-popular=""><div style="display:grid;gap:var(--space-14)" data-ex-popular-grid="">
          {#each v.popular ?? [] as c, i3}
            <div class="dc-p9" style="display:flex;flex-direction:column;min-width:0;border-radius:var(--radius-lg);background:var(--surface-2,#141419);box-sizing:border-box;border:1px solid var(--line-1,rgba(255,255,255,.07));overflow:hidden;cursor:{c.cursor}" onclick={c.open} role="button" tabindex="0">
              <span style="flex:none;height:120px;background:{c.cover}"></span>
              <div style="flex:1;display:flex;flex-direction:column;gap:var(--space-10);padding:0 var(--space-16) var(--space-16)">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-10)">
                  <span style="flex:none;width:60px;height:60px;box-sizing:border-box;margin-top:-30px;border-radius:20px;border:4px solid var(--surface-2,#141419);background:{c.avatar}"></span>
                  {#if c.hasTag}
                    <span style="margin-top:var(--space-10);display:flex;align-items:center;gap:var(--space-4);height:24px;padding:0 var(--space-10);border-radius:var(--radius-pill);background:{c.tagBg};font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:{c.tagInk}"><span style="width:11px;height:11px;background:currentColor;mask:{c.tagMask}"></span>{t(c.tag)}</span>
                  {/if}
                </div>
                <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0"><span style="min-width:0;font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.name)}</span>{#if c.verified}<span style="flex:none;width:15px;height:15px;background:var(--status-verified,#3D9BFF);mask:{v.verifiedMask}"></span>{/if}</div>
                <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:3em;margin-bottom:var(--space-10);text-wrap:pretty">{t(c.about)}</span>
                <div style="display:flex;align-items:center;gap:var(--space-12);min-height:52px;margin:auto calc(var(--space-16) * -1) calc(var(--space-16) * -1);padding:0 var(--space-16);box-sizing:border-box;border-top:1px solid var(--line-1,rgba(255,255,255,.07));background:var(--overlay-1,rgba(255,255,255,.02));font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">
                  <span style="display:flex;align-items:center;gap:var(--space-6)" title="{c.members} members"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.usersMask}"></span>{t(c.members)}</span><span style="display:flex;align-items:center;gap:var(--space-6)" title="{c.channels} channels"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.hashMask}"></span>{t(c.channels)}</span><span style="flex:1"></span>
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{c.ctaInk}">{t(c.cardCta)}</span>
                </div>
              </div>
            </div>
          {/each}
        </div></div>
      </div>
    </div>
  {/if}

  <div style="display:flex;justify-content:center;padding:0 var(--space-32) var(--space-32)">
    <div style="width:100%;max-width:1000px;container-type:inline-size;display:flex;flex-direction:column;border-radius:var(--radius-lg);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));overflow:hidden">
      <div style="display:flex;align-items:center;gap:var(--space-12);flex-wrap:wrap;padding:var(--space-14) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
        <span style="flex:1 1 200px;min-width:0;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.listTitle)} <span style="font-weight:var(--weight-regular);color:var(--ink-4,#7C7C8C)">· {t(v.listCount)}</span></span>
        {#if v.hasFilter}
          <span style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.clearFilters} role="button" tabindex="0">Clear filters</span>
        {/if}
        <div style="flex:none;display:flex;gap:2px;padding:3px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
          {#each v.sorts ?? [] as o, i4}
            <span style="display:flex;align-items:center;height:30px;padding:0 var(--space-12);border-radius:var(--radius-sm);background:{o.bg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{o.ink};cursor:pointer;user-select:none;white-space:nowrap" onclick={o.pick} role="button" tabindex="0">{t(o.label)}</span>
          {/each}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 100px 90px 110px 110px;gap:var(--space-12);padding:var(--space-10) var(--space-18);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#6E6E7C)" data-ex-row="">
        <span>COMMUNITY</span><span>MEMBERS</span><span data-ex-col="">CHANNELS</span><span data-ex-col="">LANGUAGE</span><span></span>
      </div>
      {#each v.rows ?? [] as c, i5}
        <div class="dc-p10" style="display:grid;grid-template-columns:minmax(0,1fr) 100px 90px 110px 110px;gap:var(--space-12);align-items:center;min-height:80px;padding:var(--space-14) var(--space-18);box-sizing:border-box;border-block-start:1px solid var(--line-1,rgba(255,255,255,.05));cursor:{c.cursor}" data-ex-row="" onclick={c.open} role="button" tabindex="0">
          <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0">
            <span style="flex:none;width:40px;height:40px;border-radius:13px;background:{c.avatar}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
                <span style="min-width:0;font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.name)}</span>
                {#if c.verified}<span style="flex:none;width:14px;height:14px;background:var(--status-verified,#3D9BFF);mask:{v.verifiedMask}" title="Verified"></span>{/if}
                {#if c.isPrivate}<span style="flex:none;width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.lockMask}" title="Private"></span>{/if}
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-3,#9A9AA8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.about)}</span>
            </div>
          </div>
          <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(c.members)}</span>
          <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-2,#C9C9D4)" data-ex-col="">{t(c.channels)}</span>
          <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)" data-ex-col="">{t(c.lang)}</span>
          <div style="justify-self:end;display:flex">
            {#if c.joined}
              <span style="display:flex;align-items:center;gap:var(--space-4);height:30px;padding:0 var(--space-10);border-radius:var(--radius-pill);background:color-mix(in oklch,var(--status-online,#2EE6A8) 14%,transparent);font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--status-online,#2EE6A8)"><span style="width:12px;height:12px;background:var(--status-online,#2EE6A8);mask:{v.checkMask}"></span>Joined</span>
            {/if}
            {#if c.inviteOnly}
              <span style="display:flex;align-items:center;gap:var(--space-4);height:30px;padding:0 var(--space-10);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="width:11px;height:11px;background:var(--ink-3,#9A9AA8);mask:{v.lockMask}"></span>Invite only</span>
            {/if}
            {#if c.canJoin}
              <span class="dc-p11" style="display:flex;align-items:center;height:32px;padding:0 var(--space-14);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={c.join} role="button" tabindex="0">Preview</span>
            {/if}
          </div>
        </div>
      {/each}
      {#if v.hasMore}
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding:var(--space-18) var(--space-18) var(--space-22);border-block-start:1px solid var(--line-1,rgba(255,255,255,.05))">
          <span class="dc-p12" style="display:flex;align-items:center;gap:var(--space-8);height:38px;padding:0 var(--space-18);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onLoadMore} role="button" tabindex="0">{t(v.loadMoreLabel)}<span style="width:13px;height:13px;background:var(--ink,#ECECF1);mask:{v.chevMask}"></span></span>
          <span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.shownLabel)}</span>
        </div>
      {/if}
      {#if v.listEmpty}
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);padding:var(--space-32) var(--space-18);text-align:center;border-block-start:1px solid var(--line-1,rgba(255,255,255,.05))">
          <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.emptyTitle)}</span>
          <span style="max-width:360px;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Try other languages, or start the community you were looking for.</span>
        </div>
      {/if}
    </div>
  </div>
  {/if}

  {#if v.isGuest}
    <div style="position:sticky;bottom:0;z-index:6;display:flex;justify-content:center;padding:var(--space-16) var(--space-16) var(--space-18);pointer-events:none">
      <div style="pointer-events:auto;width:100%;max-width:1080px;display:flex;align-items:center;gap:var(--space-16);flex-wrap:wrap;padding:20px 20px 20px 24px;box-sizing:border-box;border-radius:var(--radius-xl);background:color-mix(in oklch,var(--accent,#FF5672) 10%,var(--surface-2,#191921));box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 30%,transparent),0 18px 44px rgba(0,0,0,.5);animation:ex-rise 420ms 200ms cubic-bezier(.2,.8,.2,1) both" data-screen-label="Guest banner">
        <img style="flex:none;display:block;width:40px;height:40px" src="assets/openchat-logo.svg" alt="" width="40" height="40">
        <div style="flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">You're browsing as a guest</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Create an account to join communities, send messages and vote on proposals. No phone number needed.</span>
        </div>
        <div style="flex:none;display:flex;gap:var(--space-8)">
          <span class="dc-p13" style="display:flex;align-items:center;height:40px;padding:0 var(--space-16);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onSignIn} role="button" tabindex="0">Sign in</span>
          <span class="dc-p14" style="display:flex;align-items:center;height:40px;padding:0 var(--space-18);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onCreateAccount} role="button" tabindex="0">Create account</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p3:hover{border-color:var(--line-3,rgba(255,255,255,.2)) !important}
  .dc-p4:hover{border-color:var(--line-3,rgba(255,255,255,.2)) !important}
  .dc-p5:hover{filter:brightness(1.08) !important}
  .dc-p6:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p7:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p8:hover{border-color:var(--line-3,rgba(255,255,255,.2)) !important}
  .dc-p9:hover{border-color:var(--line-3,rgba(255,255,255,.2)) !important}
  .dc-p10:hover{background:var(--overlay-1,rgba(255,255,255,.035)) !important}
  .dc-p11:hover{background:var(--overlay-3,rgba(255,255,255,.14)) !important}
  .dc-p12:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p13:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p14:hover{filter:brightness(1.08) !important}
</style>
