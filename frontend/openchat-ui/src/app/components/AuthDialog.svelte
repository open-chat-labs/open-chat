<!-- Sign in / create account. Methods: passkey (primary), email magic link (sign-in only), Internet Identity, Ethereum,
     Solana and NFID (sign-in only), shown as a grid or a stacked list; the split variant adds a brand panel.
     Sign-up is a form: username (live availability check), optional recovery email, optional referrer, then Continue.
     Picking a method waits for its approval (simulated here) before onDone(method). Esc closes unless `inline`. -->
<script lang="ts">
  import { onMount } from 'svelte';

  type Method = 'passkey' | 'ii' | 'eth' | 'sol' | 'nfid';

  const OTHERS: { key: Exclude<Method, 'passkey'>; name: string; short?: string; loginOnly?: boolean; wait: string }[] = [
    { key: 'ii', name: 'Internet Identity', short: 'Internet ID', wait: 'Finish in the Internet Identity window' },
    { key: 'eth', name: 'Ethereum', wait: 'Approve the signature request in your wallet' },
    { key: 'sol', name: 'Solana', wait: 'Approve the signature request in your wallet' },
    { key: 'nfid', name: 'NFID (Legacy)', short: 'NFID', loginOnly: true, wait: 'Finish in the NFID window' },
  ];
  const WAIT_MS = 1600;
  const CHECK_MS = 450;

  interface Person {
    name: string;
    handle: string;
    /** Avatar background. */
    grad: string;
  }

  interface Props {
    kind?: 'login' | 'signup';
    variant?: 'stack' | 'grid' | 'split';
    /** Render in place instead of as a modal. */
    inline?: boolean;
    /** Subtitle, e.g. why sign-in is needed. */
    reason?: string;
    /** People a new user can name as their referrer (searched by name or handle). */
    referrers?: Person[];
    /** Sign-up: whether a well-formed username is free. Defaults to always free. */
    checkUsername?: (username: string) => boolean | Promise<boolean>;
    onClose?: () => void;
    /** Method that completed: passkey, ii, eth, sol, nfid, email or signup. */
    onDone?: (method: string) => void;
  }

  let { kind = 'login', variant = 'grid', inline = false, reason = '', referrers = [], checkUsername = () => true, onClose, onDone }: Props = $props();

  // switching between sign-in and sign-up sticks until the host changes `kind`
  let mode = $derived(kind);
  let step = $state<'methods' | 'sent'>('methods');
  let waiting = $state<Method | null>(null);
  let email = $state('');
  let username = $state('');
  let checked = $state<{ name: string; free: boolean } | null>(null);
  let refQuery = $state('');
  let referrer = $state<Person | null>(null);

  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;

  const signup = $derived(mode === 'signup');
  const view = $derived(signup && step === 'methods' ? 'form' : step);
  const verb = $derived(signup ? 'Continue with ' : 'Sign in with ');
  const wellFormed = $derived(/^[A-Za-z0-9_]{5,20}$/.test(username));
  const known = $derived(wellFormed && checked?.name === username.toLowerCase() ? checked : null);
  const taken = $derived(!!known && !known.free);
  const free = $derived(!!known && known.free);
  const badChars = $derived(!!username && /[^A-Za-z0-9_]/.test(username));
  const userMsg = $derived(badChars ? 'Only letters, numbers and underscores' : username && username.length < 5 ? 'At least 5 characters' : '');
  const emailOk = $derived(/^\S+@\S+\.\S+$/.test(email));
  const results = $derived.by(() => {
    const q = refQuery.trim().toLowerCase();
    return q ? referrers.filter((p) => p.name.toLowerCase().includes(q) || p.handle.includes(q)).slice(0, 4) : [];
  });
  const waitText = $derived(
    !waiting ? '' : waiting === 'passkey' ? (signup ? 'Create the passkey when your browser asks' : 'Choose your passkey when your browser asks') : OTHERS.find((o) => o.key === waiting)!.wait,
  );
  const others = $derived(OTHERS.filter((o) => !(signup && o.loginOnly)));

  function close() {
    clearTimeout(waitTimer);
    onClose?.();
  }

  function pick(m: Method) {
    if (waiting) return;
    waiting = m;
    waitTimer = setTimeout(() => onDone?.(m), WAIT_MS);
  }

  function typedUsername(value: string) {
    username = value;
    checked = null;
    clearTimeout(checkTimer);
    if (!/^[A-Za-z0-9_]{5,20}$/.test(value)) return;
    checkTimer = setTimeout(async () => {
      const name = value.toLowerCase();
      const ok = await checkUsername(name);
      if (username.toLowerCase() === name) checked = { name, free: ok };
    }, CHECK_MS);
  }

  function switchMode() {
    clearTimeout(waitTimer);
    mode = signup ? 'login' : 'signup';
    step = 'methods';
    waiting = null;
  }

  onMount(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inline) close();
    };
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', esc);
      clearTimeout(waitTimer);
      clearTimeout(checkTimer);
    };
  });
</script>

<div class="backdrop" class:inline onclick={close} role="button" tabindex="0">
  <div class="card {variant}" class:signup role="dialog" aria-modal="true" aria-labelledby="oc-auth-title" onclick={(e) => e.stopPropagation()}>
    {#if variant === 'split'}
      <div class="brand">
        <img class="brand-logo" src="assets/openchat-logo.svg" alt="" width="56" height="56" />
        <div class="brand-copy">
          <span class="brand-title">Fully featured. Fully yours.</span>
          <span class="brand-sub">A decentralised messenger, owned by the people who use it. No phone number needed.</span>
        </div>
      </div>
    {/if}
    <div class="column">
      <div class="head">
        {#if variant !== 'split'}<img class="logo" src="assets/openchat-logo.svg" alt="" width="48" height="48" />{/if}
        <div class="head-text">
          <h2 id="oc-auth-title">{signup ? 'Create your account' : 'Sign in to OpenChat'}</h2>
          <span class="sub">{reason || 'Fully featured. Fully secure.'}</span>
        </div>
        {#if step === 'sent'}
          <button
            class="head-button"
            onclick={() => {
              clearTimeout(waitTimer);
              step = 'methods';
              waiting = null;
            }}
            aria-label="Back"><span class="head-icon back"></span></button
          >
        {/if}
        <button class="head-button" onclick={close} aria-label="Close"><span class="head-icon close"></span></button>
      </div>

      {#if view === 'methods'}
        <div class="methods">
          <button class="passkey" style:opacity={waiting && waiting !== 'passkey' ? 0.45 : 1} onclick={() => pick('passkey')} disabled={!!waiting}
            ><span class="method-icon" style:mask="var(--icon-passkey) center/contain no-repeat"></span><span class="method-label">{signup ? 'Create a passkey' : 'Sign in with Passkey'}</span></button
          >
          {#if !signup}
            <div class="or"><span class="rule"></span>OR<span class="rule"></span></div>
            <form
              class="email"
              style:opacity={waiting ? 0.45 : 1}
              onsubmit={(e) => {
                e.preventDefault();
                if (emailOk && !waiting) step = 'sent';
              }}
            >
              <span class="email-icon"></span>
              <input data-auth-input="" type="email" bind:value={email} placeholder="Sign in with email" aria-label="Email address" disabled={!!waiting} />
              <button class="send" class:ready={emailOk} type="submit" aria-label="Send sign-in link" disabled={!emailOk || !!waiting}><span class="send-icon"></span></button>
            </form>
          {/if}
          {#if variant === 'grid'}
            <span class="more">{signup ? 'OR CONTINUE WITH' : 'MORE WAYS TO SIGN IN'}</span>
            <div class="tiles">
              {#each others as m}
                <button class="tile" style:opacity={waiting && waiting !== m.key ? 0.45 : 1} onclick={() => pick(m.key)} disabled={!!waiting} title={verb + m.name}
                  ><span class="tile-icon" style:mask="var(--icon-{m.key}) center/contain no-repeat"></span><span class="tile-label">{m.short || m.name}</span></button
                >
              {/each}
            </div>
          {:else}
            {#each others as m}
              <button class="option" style:opacity={waiting && waiting !== m.key ? 0.45 : 1} onclick={() => pick(m.key)} disabled={!!waiting}
                ><span class="method-icon" style:mask="var(--icon-{m.key}) center/contain no-repeat"></span><span class="method-label">{verb + m.name}</span></button
              >
            {/each}
          {/if}
          {#if waiting}
            <span class="wait" role="status">{waitText}…</span>
          {/if}
        </div>
      {/if}

      {#if view === 'sent'}
        <div class="sent">
          <span class="sent-tile"><span class="sent-icon"></span></span>
          <span class="sent-title">Check your inbox</span>
          <span class="sent-text">We sent a sign-in link to <span class="sent-email">{email}</span>. Open it on this device to continue.</span>
          <button class="link" onclick={() => onDone?.('email')}>I've opened the link</button>
        </div>
      {/if}

      {#if view === 'form'}
        <form
          class="form"
          onsubmit={(e) => {
            e.preventDefault();
            if (free) onDone?.('signup');
          }}
        >
          <label class="field-group">
            <span class="field-label"><span>Username</span><span class="field-note">letters, numbers and underscores</span></span>
            <span class="field" class:bad={taken || badChars} class:good={free}>
              <input data-auth-input="" value={username} oninput={(e) => typedUsername(e.currentTarget.value)} placeholder="Choose a username" maxlength="20" autocomplete="username" />
              {#if wellFormed}
                <span class="chip" class:taken class:free role="status"
                  ><span class="chip-icon" style:mask="var(--icon-{taken ? 'close' : free ? 'check' : 'more'}) center/contain no-repeat"></span>{taken
                    ? 'Taken'
                    : free
                      ? 'Available'
                      : 'Checking'}</span
                >
              {/if}
              <span class="left">{20 - username.length}</span>
            </span>
            {#if userMsg}
              <span class="user-msg" class:bad={badChars}>{userMsg}</span>
            {/if}
          </label>
          <label class="field-group spaced">
            <span class="field-label"><span>Email</span><span class="field-note">optional, only used for account recovery</span></span>
            <span class="field"><input data-auth-input="" type="email" bind:value={email} placeholder="you@example.com" autocomplete="email" /></span>
          </label>
          <div class="referral">
            <span class="field-label">Did someone refer you?</span>
            {#if referrer}
              <span class="field picked">
                <span class="face" style:background={referrer.grad}></span>
                <span class="who">{referrer.name}<span class="field-note">@{referrer.handle}</span></span>
                <button class="clear" type="button" onclick={() => (referrer = null)} aria-label="Remove referrer"><span class="head-icon close small"></span></button>
              </span>
            {:else}
              <span class="field">
                <span class="search-icon"></span>
                <input data-auth-input="" bind:value={refQuery} placeholder="Search for the person who referred you" aria-label="Referrer" />
              </span>
            {/if}
            {#if results.length}
              <div class="results" role="listbox">
                {#each results as person}
                  <button
                    class="result"
                    type="button"
                    onclick={() => {
                      referrer = person;
                      refQuery = '';
                    }}
                    role="option"
                    aria-selected="false"><span class="face" style:background={person.grad}></span><span class="who">{person.name}<span class="field-note">@{person.handle}</span></span></button
                  >
                {/each}
              </div>
            {/if}
          </div>
          <div class="submit-row">
            <span class="terms">By creating an account you agree to the <a href="#">terms and conditions</a>.</span>
            <button class="continue" class:ready={free} type="submit" disabled={!free}>Continue</button>
          </div>
        </form>
      {/if}

      <div class="switch">{signup ? 'Already have an account?' : 'New to OpenChat?'}<button class="switch-cta" onclick={switchMode}>{signup ? 'Sign in' : 'Create an account'}</button></div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    padding: 24px;
    overflow-y: auto;
    background: var(--scrim);
    backdrop-filter: blur(6px);
  }

  .backdrop.inline {
    position: relative;
    inset: auto;
    z-index: auto;
    justify-content: center;
    padding: 0;
    overflow-y: visible;
    background: none;
    backdrop-filter: none;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 460px;
    margin: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    box-sizing: border-box;
    border-radius: var(--radius-xl, 20px);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.45);
    text-align: left;
    animation: auth-rise 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .card.grid {
    max-width: 540px;
    min-height: 548px;
  }

  .card.split {
    max-width: 820px;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }

  .brand {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 32px;
    padding: 32px;
    overflow: hidden;
    border-radius: var(--radius-xl, 20px) 0 0 var(--radius-xl, 20px);
    background:
      radial-gradient(ellipse 90% 70% at 20% 0%, color-mix(in oklch, var(--accent, #ff5672) 26%, transparent), transparent 70%),
      radial-gradient(ellipse 70% 60% at 100% 100%, rgba(106, 43, 255, 0.22), transparent 70%),
      var(--surface-0, #07070a);
    box-shadow: inset -1px 0 0 var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .brand-logo {
    display: block;
    width: 56px;
    height: 56px;
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .brand-title {
    font: 800 30px/1.08 var(--font-sans);
    letter-spacing: -0.035em;
    color: var(--ink, #ececf1);
    text-wrap: balance;
  }

  .brand-sub {
    font: var(--weight-regular, 400) var(--text-md, 14px) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 28px;
  }

  .grid .column {
    gap: 32px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo {
    flex: none;
    display: block;
    width: 48px;
    height: 48px;
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  h2 {
    margin: 0;
    font: var(--weight-bold, 700) var(--text-xl, 20px) / 1.2 var(--font-sans);
    letter-spacing: -0.015em;
    color: var(--ink, #ececf1);
  }

  .sub {
    font: var(--weight-regular, 400) var(--text-md, 14px) / 1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  button {
    padding: 0;
    border: 0;
    cursor: pointer;
  }

  .head-button,
  .clear {
    flex: none;
    align-self: flex-start;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md, 10px);
    background: transparent;
    color: var(--ink-3, #9a9aa8);
  }

  .head-button:hover,
  .clear:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink, #ececf1);
  }

  .head-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
  }

  .head-icon.back {
    width: 18px;
    height: 18px;
    mask: var(--icon-back) center/contain no-repeat;
  }

  .head-icon.close {
    mask: var(--icon-close) center/contain no-repeat;
  }

  .head-icon.small {
    width: 14px;
    height: 14px;
  }

  .methods {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .grid .methods {
    gap: 20px;
  }

  .grid.signup .methods {
    gap: 14px;
  }

  .passkey,
  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 52px;
    padding: 0 16px;
    border-radius: var(--radius-lg, 14px);
  }

  .passkey {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .grid:not(.signup) .passkey {
    margin-top: 16px;
  }

  .passkey:hover {
    filter: brightness(1.06);
  }

  .option,
  .tile {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    color: var(--ink, #ececf1);
  }

  .option:hover,
  .tile:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .method-icon {
    flex: none;
    width: 20px;
    height: 20px;
    background: currentColor;
  }

  .method-label {
    flex: 1;
    text-align: center;
    margin-inline-end: 32px;
    font: var(--weight-semibold, 600) var(--text-base, 15px) / 1.2 var(--font-sans);
  }

  .or {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0;
    font: var(--weight-semibold, 600) var(--text-xs, 11px) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #7c7c8c);
  }

  .rule {
    flex: 1;
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .email {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 52px;
    margin: 0;
    padding: 0 6px 0 16px;
    box-sizing: border-box;
    border-radius: var(--radius-lg, 14px);
    background: var(--field, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .email-icon {
    flex: none;
    width: 20px;
    height: 20px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-mail) center/contain no-repeat;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font: var(--weight-regular, 400) var(--text-base, 15px) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .send {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink-4, #7c7c8c);
  }

  .send.ready {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .send-icon {
    width: 17px;
    height: 17px;
    background: currentColor;
    mask: var(--icon-send) center/contain no-repeat;
  }

  .more {
    margin-top: 16px;
    text-align: center;
    font: var(--weight-semibold, 600) var(--text-xs, 11px) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #7c7c8c);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    gap: 8px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 76px;
    padding: 0 6px;
    border-radius: var(--radius-lg, 14px);
  }

  .tile-icon {
    width: 22px;
    height: 22px;
    background: currentColor;
  }

  .tile-label {
    font: var(--weight-medium, 500) var(--text-sm, 13px) / 1.15 var(--font-sans);
    text-align: center;
  }

  .wait {
    text-align: center;
    font: var(--weight-regular, 400) var(--text-sm, 13px) / 1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .sent {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 12px 8px;
    text-align: center;
  }

  .sent-tile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .sent-icon {
    width: 24px;
    height: 24px;
    background: var(--accent, #ff5672);
    mask: var(--icon-mail) center/contain no-repeat;
  }

  .sent-title {
    font: var(--weight-semibold, 600) var(--text-lg, 17px) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .sent-text {
    max-width: 320px;
    font: var(--weight-regular, 400) var(--text-md, 14px) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .sent-email {
    font-weight: 600;
    color: var(--ink, #ececf1);
  }

  .link {
    margin-top: 6px;
    background: transparent;
    font: var(--weight-semibold, 600) var(--text-md, 14px) / 1.4 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin: 0;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-group.spaced {
    margin: 8px 0;
  }

  .field-label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    padding-left: 2px;
    font: var(--weight-semibold, 600) var(--text-md, 14px) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .field-note {
    font-weight: 400;
    color: var(--ink-4, #7c7c8c);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 14px;
    box-sizing: border-box;
    border-radius: var(--radius-md, 10px);
    background: var(--field, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .field.good {
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-online, #2ee6a8) 60%, transparent);
  }

  .field.bad {
    box-shadow: inset 0 0 0 1px var(--status-error, #f5493d);
  }

  .field.picked {
    padding: 0 8px 0 10px;
  }

  .chip {
    flex: none;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: var(--radius-pill, 99px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold, 600) var(--text-xs, 11px) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .chip.taken {
    background: color-mix(in oklch, var(--status-error, #f5493d) 16%, transparent);
    color: var(--status-error, #f5493d);
  }

  .chip.free {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 16%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .chip-icon {
    width: 12px;
    height: 12px;
    background: currentColor;
  }

  .left {
    flex: none;
    min-width: 18px;
    text-align: right;
    font: var(--weight-medium, 500) var(--text-sm, 13px) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .user-msg {
    font: var(--weight-regular, 400) var(--text-sm, 13px) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .user-msg.bad {
    color: var(--status-error, #f5493d);
  }

  .referral {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .face {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font: var(--weight-semibold, 600) var(--text-md, 14px) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .clear {
    align-self: auto;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .search-icon {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .results {
    position: absolute;
    top: calc(100% + 6px);
    inset-inline: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-radius: var(--radius-lg, 14px);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 16px 40px rgba(0, 0, 0, 0.4);
  }

  .result {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 10px;
    border-radius: var(--radius-md, 10px);
    background: transparent;
    text-align: left;
  }

  .result:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .result .who {
    flex: none;
  }

  .submit-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  .terms {
    flex: 1 1 200px;
    font: var(--weight-regular, 400) var(--text-sm, 13px) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .terms a {
    color: var(--accent, #ff5672);
  }

  .continue {
    flex: none;
    display: flex;
    align-items: center;
    height: 46px;
    padding: 0 24px;
    border-radius: var(--radius-md, 10px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    cursor: not-allowed;
    font: var(--weight-semibold, 600) var(--text-base, 15px) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .continue.ready {
    background: var(--accent, #ff5672);
    cursor: pointer;
    color: var(--on-accent, #2e0512);
  }

  .switch {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
    font: var(--weight-regular, 400) var(--text-base, 15px) / 1.4 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .switch-cta {
    background: transparent;
    font: var(--weight-bold, 700) var(--text-base, 15px) / 1.4 var(--font-sans);
    color: var(--accent, #ff5672);
    text-underline-offset: 3px;
  }

  .switch-cta:hover {
    text-decoration: underline;
  }
</style>
