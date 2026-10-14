<!-- Sign in / create account. Methods: passkey (primary), email magic link (sign-in only), Internet Identity, Ethereum,
     Solana and NFID (sign-in only), shown as a grid or a stacked list; the split variant adds a brand panel.
     Sign-up is a form: username (live availability check), optional recovery email, optional referrer, then Continue.
     The host does the real work: onMethod (passkey, wallets …), onRequestEmailLink and onSignup each return a promise;
     the dialog shows the waiting state until it settles and goes back to the choices if it rejects. The host decides
     when sign-in has succeeded and closes the dialog. Esc and the scrim close it unless `inline`. -->
<script lang="ts" module>
  export type AuthMethod = 'passkey' | 'ii' | 'eth' | 'sol' | 'nfid';
  export interface SignupDetails {
    username: string;
    /** Optional recovery email. */
    email?: string;
    /** Handle of the person who referred them. */
    referrer?: string;
    /** User id of the referrer, when the host supplied one. */
    referrerId?: string;
  }

  export interface AuthPerson {
    /** Passed back as SignupDetails.referrerId. */
    userId?: string;
    name: string;
    handle: string;
    /** Avatar background. */
    grad: string;
  }
</script>

<script lang="ts">
  import { modal } from '../../lib/behaviours/modal';
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onMount, untrack } from 'svelte';

  type Method = AuthMethod;

  const OTHERS: { key: Exclude<Method, 'passkey'>; name: string; short?: string; loginOnly?: boolean; wait: string }[] = [
    // names are product names (or keys, where they carry copy); wait lines are keys
    { key: 'ii', name: 'Internet Identity', short: 'Internet ID', wait: 'ui.authDialog.waitIi' },
    { key: 'eth', name: 'Ethereum', wait: 'ui.authDialog.waitWallet' },
    { key: 'sol', name: 'Solana', wait: 'ui.authDialog.waitWallet' },
    { key: 'nfid', name: 'ui.authDialog.nfidLegacy', short: 'NFID', loginOnly: true, wait: 'ui.authDialog.waitNfid' },
  ];
  const CHECK_MS = 450;

  type Person = AuthPerson;

  interface Props {
    kind?: 'login' | 'signup';
    variant?: 'stack' | 'grid' | 'split';
    /** Render in place instead of as a modal. */
    inline?: boolean;
    /** Subtitle, e.g. why sign-in is needed. Resource key (or literal text). */
    reason?: string;
    /** People a new user can name as their referrer (searched by name or handle). */
    referrers?: Person[];
    /** Search referrers on the server; replaces the local `referrers` filter when given. */
    searchReferrers?: (query: string) => Promise<Person[]>;
    /** Sign-up: whether a well-formed username is free. Without it no availability is shown (the host checks on signup). */
    checkUsername?: (username: string) => boolean | Promise<boolean>;
    /** Terms and conditions page; without it the words aren't a link. */
    termsUrl?: string;
    onClose?: () => void;
    /** Start sign-in / sign-up with a method (passkey prompt, wallet, II window). Waits until it settles; reject to go back. */
    onMethod?: (method: AuthMethod, kind: 'login' | 'signup') => Promise<unknown> | void;
    /** Send a sign-in link to this address. The dialog shows "Check your inbox" once it resolves; also used to resend. */
    onRequestEmailLink?: (email: string) => Promise<unknown> | void;
    /** Create the account from the form. Waits until it settles; reject to stay on the form. */
    onSignup?: (details: SignupDetails) => Promise<unknown> | void;
  }

  let { kind = 'login', variant = 'grid', inline = false, reason = '', referrers = [], searchReferrers, checkUsername, termsUrl, onClose, onMethod, onRequestEmailLink, onSignup }: Props = $props();
  const t = useT();

  // switching between sign-in and sign-up sticks until the host changes `kind`
  let mode = $derived(kind);
  let step = $state<'methods' | 'sent'>('methods');
  let waiting = $state<Method | 'email' | 'signup' | null>(null);
  // a newer action (or Back / switching mode) makes an older pending one stale
  let run = 0;
  let email = $state('');
  let username = $state('');
  // free: available; taken; error: the check itself failed
  let checked = $state<{ name: string; state: 'free' | 'taken' | 'error' } | null>(null);
  // the last host action that failed (shown under the form / methods)
  let failed = $state<Method | 'email' | 'signup' | null>(null);
  let remoteResults = $state<Person[] | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchRun = 0;
  let refQuery = $state('');
  let referrer = $state<Person | null>(null);

  let checkTimer: ReturnType<typeof setTimeout> | undefined;

  const signup = $derived(mode === 'signup');
  const view = $derived(signup && step === 'methods' ? 'form' : step);
  const withMethod = (name: string) => t(signup ? 'ui.authDialog.continueWith' : 'ui.authDialog.signInWith', { name: t(name) });
  const wellFormed = $derived(/^[A-Za-z0-9_]{5,20}$/.test(username));
  const known = $derived(wellFormed && checked?.name === username.toLowerCase() ? checked : null);
  const taken = $derived(known?.state === 'taken');
  const checkFailed = $derived(known?.state === 'error');
  // without a checker any well-formed name can be submitted; the host decides
  const free = $derived(checkUsername ? known?.state === 'free' : wellFormed);
  const badChars = $derived(!!username && /[^A-Za-z0-9_]/.test(username));
  const userMsg = $derived(badChars ? t('ui.authDialog.onlyLetters') : username && username.length < 5 ? t('ui.authDialog.atLeast5') : '');
  const emailOk = $derived(/^\S+@\S+\.\S+$/.test(email));
  // sign-up's recovery email is optional, but a malformed one blocks Continue instead of being dropped
  const recoveryBad = $derived(!!email.trim() && !emailOk);
  const results = $derived.by(() => {
    const q = refQuery.trim().toLowerCase();
    if (!q) return [];
    if (searchReferrers) return (remoteResults ?? []).slice(0, 4);
    return referrers.filter((p) => p.name.toLowerCase().includes(q) || p.handle.includes(q)).slice(0, 4);
  });

  // server-side referrer search, debounced; only the latest query's answer is kept
  $effect(() => {
    const q = refQuery.trim();
    if (!searchReferrers) return;
    untrack(() => {
      clearTimeout(searchTimer);
      remoteResults = null;
      if (!q) return;
      const mine = ++searchRun;
      searchTimer = setTimeout(async () => {
        try {
          const found = await searchReferrers(q);
          if (mine === searchRun) remoteResults = found;
        } catch {
          if (mine === searchRun) remoteResults = [];
        }
      }, CHECK_MS);
    });
  });
  const waitText = $derived(
    !waiting || waiting === 'email' || waiting === 'signup'
      ? ''
      : t(waiting === 'passkey' ? (signup ? 'ui.authDialog.waitPasskeyCreate' : 'ui.authDialog.waitPasskeyChoose') : OTHERS.find((o) => o.key === waiting)!.wait),
  );
  const others = $derived(OTHERS.filter((o) => !(signup && o.loginOnly)));

  function close() {
    run++;
    onClose?.();
  }

  // runs a host action with `what` as the waiting state; resolves true when it succeeded and is still current
  async function attempt(what: NonNullable<typeof waiting>, action: () => Promise<unknown> | void): Promise<boolean> {
    if (waiting) return false;
    const mine = ++run;
    waiting = what;
    failed = null;
    try {
      await action();
      return mine === run;
    } catch {
      if (mine === run) failed = what;
      return false;
    } finally {
      if (mine === run) waiting = null;
    }
  }

  function pick(m: Method) {
    if (onMethod) attempt(m, () => onMethod(m, signup ? 'signup' : 'login'));
  }

  async function requestLink() {
    if (!emailOk || !onRequestEmailLink) return;
    if (await attempt('email', () => onRequestEmailLink(email))) step = 'sent';
  }

  function submitSignup() {
    if (!free || recoveryBad || !onSignup) return;
    attempt('signup', () => onSignup({ username, email: emailOk ? email.trim() : undefined, referrer: referrer?.handle, referrerId: referrer?.userId }));
  }

  function typedUsername(value: string) {
    username = value;
    checked = null;
    clearTimeout(checkTimer);
    if (!checkUsername || !/^[A-Za-z0-9_]{5,20}$/.test(value)) return;
    const check = checkUsername;
    checkTimer = setTimeout(async () => {
      const name = value.toLowerCase();
      let state: 'free' | 'taken' | 'error';
      try {
        state = (await check(name)) ? 'free' : 'taken';
      } catch {
        state = 'error';
      }
      if (username.toLowerCase() === name) checked = { name, state };
    }, CHECK_MS);
  }

  function switchMode() {
    run++;
    mode = signup ? 'login' : 'signup';
    step = 'methods';
    waiting = null;
    failed = null;
  }

  onMount(() => {
    return () => {
      run++;
      searchRun++;
      clearTimeout(checkTimer);
      clearTimeout(searchTimer);
    };
  });
</script>

<div class="backdrop" class:inline>
  {#if !inline}<div class="scrim" onclick={close} aria-hidden="true"></div>{/if}
  <div class="card {variant}" class:signup role="dialog" aria-modal={inline ? undefined : 'true'} aria-labelledby="oc-auth-title" use:modal={inline ? undefined : close}>
    {#if variant === 'split'}
      <div class="brand">
        <img class="brand-logo" src="assets/openchat-logo.svg" alt="" width="56" height="56" />
        <div class="brand-copy">
          <span class="brand-title">{t('ui.authDialog.brandTitle')}</span>
          <span class="brand-sub">{t('ui.authDialog.brandSub')}</span>
        </div>
      </div>
    {/if}
    <div class="column">
      <div class="head">
        {#if variant !== 'split'}<img class="logo" src="assets/openchat-logo.svg" alt="" width="48" height="48" />{/if}
        <div class="head-text">
          <h2 id="oc-auth-title">{t(signup ? 'ui.authDialog.createAccountTitle' : 'ui.authDialog.signInTitle')}</h2>
          <span class="sub">{t(reason || 'ui.authDialog.defaultReason')}</span>
        </div>
        {#if step === 'sent'}
          <button
            class="head-button"
            onclick={() => {
              run++;
              step = 'methods';
              waiting = null;
            }}
            aria-label={t('ui.common.back')}><span class="head-icon back"></span></button
          >
        {/if}
        <button class="head-button" onclick={close} aria-label={t('ui.common.close')}><span class="head-icon close"></span></button>
      </div>

      {#if view === 'methods'}
        <div class="methods">
          <button class="passkey" style:opacity={waiting && waiting !== 'passkey' ? 0.45 : 1} onclick={() => pick('passkey')} disabled={!!waiting}
            ><span class="method-icon" style:mask="var(--icon-passkey) center/contain no-repeat"></span><span class="method-label">{t(signup ? 'ui.authDialog.createPasskey' : 'ui.authDialog.signInPasskey')}</span></button
          >
          {#if !signup}
            <div class="or"><span class="rule"></span>{t('ui.authDialog.or')}<span class="rule"></span></div>
            <form
              class="email"
              style:opacity={waiting ? 0.45 : 1}
              onsubmit={(e) => {
                e.preventDefault();
                requestLink();
              }}
            >
              <span class="email-icon"></span>
              <input data-auth-input="" type="email" bind:value={email} placeholder={t('ui.authDialog.emailPlaceholder')} aria-label={t('ui.authDialog.emailAddress')} disabled={!!waiting} />
              <button class="send" class:ready={emailOk} type="submit" aria-label={t('ui.authDialog.sendLink')} disabled={!emailOk || !!waiting}><span class="send-icon"></span></button>
            </form>
          {/if}
          {#if variant === 'grid'}
            <span class="more">{t(signup ? 'ui.authDialog.orContinueWith' : 'ui.authDialog.moreWays')}</span>
            <div class="tiles">
              {#each others as m}
                <button class="tile" style:opacity={waiting && waiting !== m.key ? 0.45 : 1} onclick={() => pick(m.key)} disabled={!!waiting} title={withMethod(m.name)}
                  ><span class="tile-icon" style:mask="var(--icon-{m.key}) center/contain no-repeat"></span><span class="tile-label">{t(m.short || m.name)}</span></button
                >
              {/each}
            </div>
          {:else}
            {#each others as m}
              <button class="option" style:opacity={waiting && waiting !== m.key ? 0.45 : 1} onclick={() => pick(m.key)} disabled={!!waiting}
                ><span class="method-icon" style:mask="var(--icon-{m.key}) center/contain no-repeat"></span><span class="method-label">{withMethod(m.name)}</span></button
              >
            {/each}
          {/if}
          {#if waiting}
            <span class="wait" role="status">{waitText}…</span>
          {:else if failed && failed !== 'signup'}
            <span class="wait failed" role="alert">{t(failed === 'email' ? 'ui.authDialog.linkFailed' : 'ui.authDialog.methodFailed')}</span>
          {/if}
        </div>
      {/if}

      {#if view === 'sent'}
        <div class="sent">
          <span class="sent-tile"><span class="sent-icon"></span></span>
          <span class="sent-title">{t('ui.authDialog.checkInbox')}</span>
          <span class="sent-text"><Translate key="ui.authDialog.sent">{#snippet address()}<span class="sent-email">{email}</span>{/snippet}</Translate></span>
          <button class="link" onclick={requestLink} disabled={!!waiting}>{t(waiting === 'email' ? 'ui.authDialog.sending' : 'ui.authDialog.resendLink')}</button>
        </div>
      {/if}

      {#if view === 'form'}
        <form
          class="form"
          onsubmit={(e) => {
            e.preventDefault();
            submitSignup();
          }}
        >
          <label class="field-group">
            <span class="field-label"><span>{t('ui.authDialog.username')}</span><span class="field-note">{t('ui.authDialog.usernameNote')}</span></span>
            <span class="field" class:bad={taken || badChars} class:good={free}>
              <input data-auth-input="" value={username} oninput={(e) => typedUsername(e.currentTarget.value)} placeholder={t('ui.authDialog.usernamePlaceholder')} maxlength="20" autocomplete="username" />
              {#if wellFormed && checkUsername}
                <span class="chip" class:taken={taken || checkFailed} class:free role="status"
                  ><span class="chip-icon" style:mask="var(--icon-{taken || checkFailed ? 'close' : free ? 'check' : 'more'}) center/contain no-repeat"></span>{t(
                    taken ? 'ui.authDialog.taken' : checkFailed ? 'ui.authDialog.checkFailed' : free ? 'ui.authDialog.available' : 'ui.authDialog.checking',
                  )}</span
                >
              {/if}
              <span class="left">{20 - username.length}</span>
            </span>
            {#if userMsg}
              <span class="user-msg" class:bad={badChars}>{userMsg}</span>
            {/if}
          </label>
          <label class="field-group spaced">
            <span class="field-label"><span>{t('ui.authDialog.email')}</span><span class="field-note">{t('ui.authDialog.emailNote')}</span></span>
            <span class="field" class:bad={recoveryBad}><input data-auth-input="" type="email" bind:value={email} placeholder={t('ui.authDialog.emailExample')} autocomplete="email" /></span>
            {#if recoveryBad}<span class="user-msg bad">{t('ui.authDialog.emailInvalid')}</span>{/if}
          </label>
          <div class="referral">
            <span class="field-label">{t('ui.authDialog.referredQuestion')}</span>
            {#if referrer}
              <span class="field picked">
                <span class="face" style:background={referrer.grad}></span>
                <span class="who">{referrer.name}<span class="field-note">@{referrer.handle}</span></span>
                <button class="clear" type="button" onclick={() => (referrer = null)} aria-label={t('ui.authDialog.removeReferrer')}><span class="head-icon close small"></span></button>
              </span>
            {:else}
              <span class="field">
                <span class="search-icon"></span>
                <input data-auth-input="" bind:value={refQuery} placeholder={t('ui.authDialog.referrerSearch')} aria-label={t('ui.authDialog.referrer')} />
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
            <span class="terms"
              ><Translate key="ui.authDialog.terms"
                >{#snippet link()}{#if termsUrl}<a href={termsUrl} target="_blank" rel="noopener">{t('ui.authDialog.termsLink')}</a>{:else}{t('ui.authDialog.termsLink')}{/if}{/snippet}</Translate
              >{#if failed === 'signup'}<span class="signup-error" role="alert">{t('ui.authDialog.signupFailed')}</span>{/if}</span
            >
            <button class="continue" class:ready={free && !recoveryBad && !waiting} type="submit" disabled={!free || recoveryBad || !!waiting}>{t(waiting === 'signup' ? 'ui.authDialog.creating' : 'ui.common.continue')}</button>
          </div>
        </form>
      {/if}

      <div class="switch">{t(signup ? 'ui.authDialog.haveAccount' : 'ui.authDialog.newToOpenChat')}<button class="switch-cta" onclick={switchMode}>{t(signup ? 'ui.authDialog.signIn' : 'ui.authDialog.createAnAccount')}</button></div>
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

  /* catches presses around the card; the backdrop paints the dim */
  .scrim {
    position: fixed;
    inset: 0;
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

  .wait.failed,
  .signup-error {
    color: var(--status-danger, #f5493d);
  }

  .signup-error {
    display: block;
    margin-block-start: 4px;
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
