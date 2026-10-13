<!-- Generated from lib/AuthDialog.dc.html (source hash f22ab84b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './AuthDialog.logic.js';

  interface Props {
    kind?: 'login'|'signup';
    variant?: string;
    inline?: boolean;
    reason?: string;
    onClose?: () => void;
    onDone?: (method: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style={v.backdropStyle} onclick={v.close} role="button" tabindex="0">
  <div style="position:relative;width:100%;max-width:{v.cardMax};margin:auto;min-height:{v.cardMinH};overflow:visible;display:grid;grid-template-columns:{v.cardCols};box-sizing:border-box;border-radius:var(--radius-xl,20px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45);text-align:left;animation:auth-rise 240ms cubic-bezier(.2,.8,.2,1) both" role="dialog" aria-modal="true" aria-labelledby="oc-auth-title" onclick={v.stop}>
    {#if v.isSplit}
      <div style="position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:32px;padding:32px;overflow:hidden;border-radius:var(--radius-xl,20px) 0 0 var(--radius-xl,20px);background:radial-gradient(ellipse 90% 70% at 20% 0%,color-mix(in oklch,var(--accent,#FF5672) 26%,transparent),transparent 70%),radial-gradient(ellipse 70% 60% at 100% 100%,rgba(106,43,255,.22),transparent 70%),var(--surface-0,#07070a);box-shadow:inset -1px 0 0 var(--line-1,rgba(255,255,255,.07))">
        <img style="display:block;width:56px;height:56px" src="assets/openchat-logo.svg" alt="" width="56" height="56">
        <div style="display:flex;flex-direction:column;gap:10px">
          <span style="font:800 30px/1.08 var(--font-sans);letter-spacing:-.035em;color:var(--ink,#ECECF1);text-wrap:balance">Fully featured. Fully yours.</span>
          <span style="font:var(--weight-regular,400) var(--text-md,14px)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">A decentralised messenger, owned by the people who use it. No phone number needed.</span>
        </div>
      </div>
    {/if}
    <div style="min-width:0;display:flex;flex-direction:column;gap:{v.colGap};padding:28px">

    <div style="display:flex;align-items:center;gap:14px">
      {#if v.notSplit}<img style="flex:none;display:block;width:48px;height:48px" src="assets/openchat-logo.svg" alt="" width="48" height="48">{/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <h2 style="margin:0;font:var(--weight-bold,700) var(--text-xl,20px)/1.2 var(--font-sans);letter-spacing:-.015em;color:var(--ink,#ECECF1)" id="oc-auth-title">{t(v.title)}</h2>
        <span style="font:var(--weight-regular,400) var(--text-md,14px)/1.4 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.sub)}</span>
      </div>
      {#if v.canBack}
        <button class="dc-p0" style="flex:none;align-self:flex-start;display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:var(--radius-md,10px);background:transparent;cursor:pointer;color:var(--ink-3,#9A9AA8)" onclick={v.back} aria-label="Back"><span style="width:18px;height:18px;background:currentColor;mask:{v.backMask}"></span></button>
      {/if}
      <button class="dc-p1" style="flex:none;align-self:flex-start;display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:var(--radius-md,10px);background:transparent;cursor:pointer;color:var(--ink-3,#9A9AA8)" onclick={v.close} aria-label="Close"><span style="width:16px;height:16px;background:currentColor;mask:{v.closeMask}"></span></button>
    </div>

    {#if v.showMethods}
      <div style="display:flex;flex-direction:column;gap:{v.methodsGap}">
        <button class="dc-p2" style="margin-top:{v.passkeyTop};display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;border:0;border-radius:var(--radius-lg,14px);background:var(--accent,#FF5672);cursor:pointer;color:var(--on-accent,#2E0512);opacity:{v.passkey.op}" onclick={v.passkey.pick} disabled={v.passkey.disabled}><span style="flex:none;width:20px;height:20px;background:currentColor;mask:{v.passkey.mask}"></span><span style="flex:1;text-align:center;margin-inline-end:32px;font:var(--weight-semibold,600) var(--text-base,15px)/1.2 var(--font-sans)">{t(v.passkey.label)}</span></button>
        {#if v.showEmail}
          <div style="display:flex;align-items:center;gap:12px;margin:8px 0;font:var(--weight-semibold,600) var(--text-xs,11px)/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#7C7C8C)"><span style="flex:1;height:1px;background:var(--line-1,rgba(255,255,255,.07))"></span>OR<span style="flex:1;height:1px;background:var(--line-1,rgba(255,255,255,.07))"></span></div>
          <form style="display:flex;align-items:center;gap:12px;height:52px;margin:0;padding:0 6px 0 16px;box-sizing:border-box;border-radius:var(--radius-lg,14px);background:var(--field,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));opacity:{v.emailOp}" onsubmit={v.sendEmail}>
            <span style="flex:none;width:20px;height:20px;background:var(--ink-3,#9A9AA8);mask:{v.mailMask}"></span>
            <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;font:var(--weight-regular,400) var(--text-base,15px)/1 var(--font-sans);color:var(--ink,#ECECF1)" data-auth-input="" type="email" value={v.email} oninput={v.onEmail} placeholder="Sign in with email" aria-label="Email address" disabled={v.busy}>
            <button style="flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:0;border-radius:10px;background:{v.sendBg};cursor:pointer;color:{v.sendInk}" type="submit" aria-label="Send sign-in link" disabled={v.emailDisabled}><span style="width:17px;height:17px;background:currentColor;mask:{v.sendMask}"></span></button>
          </form>
        {/if}
        {#if v.isGrid}
          <span style="margin-top:16px;text-align:center;font:var(--weight-semibold,600) var(--text-xs,11px)/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#7C7C8C)">{t(v.moreLabel)}</span>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px">
            {#each v.others ?? [] as m, i0}
              <button class="dc-p3" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:76px;padding:0 6px;border:0;border-radius:var(--radius-lg,14px);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer;color:var(--ink,#ECECF1);opacity:{m.op}" onclick={m.pick} disabled={m.disabled} title={m.label}><span style="width:22px;height:22px;background:currentColor;mask:{m.mask}"></span><span style="font:var(--weight-medium,500) var(--text-sm,13px)/1.15 var(--font-sans);text-align:center">{t(m.short)}</span></button>
            {/each}
          </div>
        {/if}
        {#if v.notGrid}
        {#each v.others ?? [] as m, i1}
          <button class="dc-p4" style="display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;border:0;border-radius:var(--radius-lg,14px);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer;color:var(--ink,#ECECF1);opacity:{m.op}" onclick={m.pick} disabled={m.disabled}><span style="flex:none;width:20px;height:20px;background:currentColor;mask:{m.mask}"></span><span style="flex:1;text-align:center;margin-inline-end:32px;font:var(--weight-semibold,600) var(--text-base,15px)/1.2 var(--font-sans)">{t(m.label)}</span></button>
        {/each}
        {/if}
        {#if v.hasWait}
          <span style="text-align:center;font:var(--weight-regular,400) var(--text-sm,13px)/1.4 var(--font-sans);color:var(--ink-3,#9A9AA8)" role="status">{t(v.waitText)}</span>
        {/if}
      </div>
    {/if}

    {#if v.showSent}
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px 8px;text-align:center">
        <span style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:16px;background:var(--accent-soft,rgba(255,86,114,.1))"><span style="width:24px;height:24px;background:var(--accent,#FF5672);mask:{v.mailMask}"></span></span>
        <span style="font:var(--weight-semibold,600) var(--text-lg,17px)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">Check your inbox</span>
        <span style="max-width:320px;font:var(--weight-regular,400) var(--text-md,14px)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">We sent a sign-in link to <span style="font-weight:600;color:var(--ink,#ECECF1)">{t(v.email)}</span>. Open it on this device to continue.</span>
        <button style="margin-top:6px;padding:0;border:0;background:transparent;cursor:pointer;font:var(--weight-semibold,600) var(--text-md,14px)/1.4 var(--font-sans);color:var(--accent,#FF5672)" onclick={v.simulateLink}>I've opened the link</button>
      </div>
    {/if}

    {#if v.showForm}
      <form style="display:flex;flex-direction:column;gap:18px;margin:0" onsubmit={v.proceed}>
        <label style="display:flex;flex-direction:column;gap:8px">
          <span style="display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;padding-left:2px;font:var(--weight-semibold,600) var(--text-md,14px)/1.3 var(--font-sans);color:var(--ink,#ECECF1)"><span>Username</span><span style="font-weight:400;color:var(--ink-4,#7C7C8C)">letters, numbers and underscores</span></span>
          <span style="display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;box-sizing:border-box;border-radius:var(--radius-md,10px);background:var(--field,rgba(255,255,255,.05));box-shadow:{v.userRing}">
            <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;font:var(--weight-regular,400) var(--text-base,15px)/1 var(--font-sans);color:var(--ink,#ECECF1)" data-auth-input="" value={v.username} oninput={v.onUsername} placeholder="Choose a username" maxlength="20" autocomplete="username">
            {#if v.hasChip}
              <span style="flex:none;display:flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:var(--radius-pill,99px);background:{v.chip.bg};font:var(--weight-semibold,600) var(--text-xs,11px)/1 var(--font-sans);color:{v.chip.ink}" role="status"><span style="width:12px;height:12px;background:currentColor;mask:{v.chip.mask}"></span>{t(v.chip.label)}</span>
            {/if}
            <span style="flex:none;min-width:18px;text-align:right;font:var(--weight-medium,500) var(--text-sm,13px)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.userLeft)}</span>
          </span>
          {#if v.hasUserMsg}
            <span style="font:var(--weight-regular,400) var(--text-sm,13px)/1.3 var(--font-sans);color:{v.userMsgInk}">{t(v.userMsg)}</span>
          {/if}
        </label>
        <label style="display:flex;flex-direction:column;gap:8px;margin:8px 0">
          <span style="display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;padding-left:2px;font:var(--weight-semibold,600) var(--text-md,14px)/1.3 var(--font-sans);color:var(--ink,#ECECF1)"><span>Email</span><span style="font-weight:400;color:var(--ink-4,#7C7C8C)">optional, only used for account recovery</span></span>
          <span style="display:flex;align-items:center;height:48px;padding:0 14px;box-sizing:border-box;border-radius:var(--radius-md,10px);background:var(--field,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
            <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;font:var(--weight-regular,400) var(--text-base,15px)/1 var(--font-sans);color:var(--ink,#ECECF1)" data-auth-input="" type="email" value={v.email} oninput={v.onEmail} placeholder="you@example.com" autocomplete="email">
          </span>
        </label>
        <div style="position:relative;display:flex;flex-direction:column;gap:8px">
          <span style="padding-left:2px;font:var(--weight-semibold,600) var(--text-md,14px)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">Did someone refer you?</span>
          {#if v.hasReferrer}
            <span style="display:flex;align-items:center;gap:10px;height:48px;padding:0 8px 0 10px;box-sizing:border-box;border-radius:var(--radius-md,10px);background:var(--field,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
              <span style="flex:none;width:28px;height:28px;border-radius:50%;background:{v.referrer.grad}"></span>
              <span style="flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;font:var(--weight-semibold,600) var(--text-md,14px)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.referrer.name)}<span style="font-weight:400;color:var(--ink-4,#7C7C8C)">@{t(v.referrer.handle)}</span></span>
              <button class="dc-p5" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;cursor:pointer;color:var(--ink-3,#9A9AA8)" type="button" onclick={v.clearReferrer} aria-label="Remove referrer"><span style="width:14px;height:14px;background:currentColor;mask:{v.closeMask}"></span></button>
            </span>
          {/if}
          {#if v.noReferrer}
            <span style="display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;box-sizing:border-box;border-radius:var(--radius-md,10px);background:var(--field,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
              <span style="flex:none;width:17px;height:17px;background:var(--ink-3,#9A9AA8);mask:{v.searchMask}"></span>
              <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;font:var(--weight-regular,400) var(--text-base,15px)/1 var(--font-sans);color:var(--ink,#ECECF1)" data-auth-input="" value={v.refQuery} oninput={v.onRefQuery} placeholder="Search for the person who referred you" aria-label="Referrer">
            </span>
          {/if}
          {#if v.hasRefResults}
            <div style="position:absolute;top:calc(100% + 6px);inset-inline:0;z-index:5;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:var(--radius-lg,14px);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 16px 40px rgba(0,0,0,.4)" role="listbox">
              {#each v.refResults ?? [] as u, i2}
                <button class="dc-p6" style="display:flex;align-items:center;gap:10px;height:44px;padding:0 10px;border:0;border-radius:var(--radius-md,10px);background:transparent;cursor:pointer;text-align:left" type="button" onclick={u.pick} role="option"><span style="flex:none;width:28px;height:28px;border-radius:50%;background:{u.grad}"></span><span style="display:flex;align-items:baseline;gap:6px;font:var(--weight-semibold,600) var(--text-md,14px)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(u.name)}<span style="font-weight:400;color:var(--ink-4,#7C7C8C)">@{t(u.handle)}</span></span></button>
              {/each}
            </div>
          {/if}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:4px">
          <span style="flex:1 1 200px;font:var(--weight-regular,400) var(--text-sm,13px)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">By creating an account you agree to the <a style="color:var(--accent,#FF5672)" href="#">terms and conditions</a>.</span>
          <button style="flex:none;display:flex;align-items:center;height:46px;padding:0 24px;border:0;border-radius:var(--radius-md,10px);background:{v.proceedBg};cursor:{v.proceedCursor};font:var(--weight-semibold,600) var(--text-base,15px)/1 var(--font-sans);color:{v.proceedInk}" type="submit" disabled={v.cantProceed}>Continue</button>
        </div>
      </form>
    {/if}

    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:20px;border-top:1px solid var(--line-1,rgba(255,255,255,.07));font:var(--weight-regular,400) var(--text-base,15px)/1.4 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.switchText)}<button class="dc-p7" style="padding:0;border:0;background:transparent;cursor:pointer;font:var(--weight-bold,700) var(--text-base,15px)/1.4 var(--font-sans);color:var(--accent,#FF5672);text-underline-offset:3px" onclick={v.switchKind}>{t(v.switchCta)}</button></div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p2:hover{filter:brightness(1.06) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p5:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p7:hover{text-decoration:underline !important}
</style>
