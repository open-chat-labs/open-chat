<!-- Wallet settings, applied as you go (every change reaches onChange at once). Sections: Tokens (automatic list by
     minimum value, or hand-picked through the Token list sheet), Security (PIN on transfers), Display currency, and
     Recipients (saved addresses; only reachable via `section`).
     The PIN itself goes to the host: setting it (choose + confirm) calls onSetPin, changing it asks for the current PIN
     first (onChangePin), and turning it off needs the current PIN too (onDisablePin). `pinOn` only changes once the host's
     promise resolves; a rejection keeps the sheet open with an error. Without those callbacks the PIN can't be managed.
     `value` stays the source of truth: edits made here show at once and are dropped when the host sends a new `value`.
     Saved recipients go through onSaveRecipient / onRemoveRecipient when given (the host assigns ids; a rejection keeps
     the sheet open, a failed removal comes back); otherwise they ride along in onChange. -->
<script lang="ts" module>
  /** A saved send-to address; the network is read off the address itself. */
  export interface SavedRecipient {
    id: string;
    name: string;
    address: string;
    /** Only this token can be sent to it. */
    token?: string | null;
  }

  export interface WalletSettings {
    pinOn: boolean;
    /** Show every held token worth at least minBalance (USD); off = only `tokens`. */
    autoConfig: boolean;
    minBalance: string;
    /** Hand-picked token symbols. */
    tokens: string[];
    currency: 'USD' | 'BTC' | 'ETH' | 'ICP';
    recipients: SavedRecipient[];
  }
</script>

<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import type { WalletToken } from '../../lib/types';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { getI18n, useT } from '../../lib/i18n';
  // minBalance accepts "," or "." as the decimal mark and is stored with "." so hosts can parse it as a number
  import { cleanAmount, parseAmount } from '../../lib/amount';
  const i18n = getI18n(); // number formatting follows the host locale

  type Section = 'tokens' | 'recipients' | 'security' | 'currency';

  // which network an address belongs to, read off its own shape
  const NETWORKS = [
    { id: 'BTC', test: (a: string) => /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a) },
    { id: 'ETH', test: (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) },
    { id: 'XRP', test: (a: string) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) },
    { id: 'ICP', test: (a: string) => /^([a-z0-9]{5}-){4,10}[a-z0-9]{3}$/.test(a) || /^[0-9a-f]{64}$/.test(a) },
  ];
  const detect = (a: string) => {
    const v = a.trim();
    if (!v) return null;
    return NETWORKS.find((n) => n.test(v))?.id ?? 'unknown';
  };
  const shortAddr = (a: string) => (a.length > 26 ? `${a.slice(0, 12)}…${a.slice(-8)}` : a);
  const money = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: 0 })}`;
  const CURRENCIES = ['USD', 'BTC', 'ETH', 'ICP'] as const;
  const CHIP_CAP = 10;
  const NAV: { key: Section; label: string; icon: string }[] = [
    { key: 'tokens', label: 'ui.walletSettingsDialog.nav.tokens', icon: 'coins' },
    { key: 'security', label: 'ui.walletSettingsDialog.nav.security', icon: 'lock' },
    { key: 'currency', label: 'ui.walletSettingsDialog.nav.currency', icon: 'currency' },
  ];

  interface Props {
    /** Wallet tokens; the ones with a balance can be listed. */
    tokens: WalletToken[];
    value?: Partial<WalletSettings> | null;
    section?: Section;
    onChange?: (settings: WalletSettings) => void;
    /** Store a new transfer PIN. Reject to show an error. */
    onSetPin?: (pin: string) => Promise<unknown>;
    /** Replace the PIN; reject if `current` is wrong. */
    onChangePin?: (current: string, next: string) => Promise<unknown>;
    /** Turn the PIN off; reject if `current` is wrong. */
    onDisablePin?: (current: string) => Promise<unknown>;
    /** Add (no id) or edit a saved recipient; resolve with the stored entry, with its id. Reject to keep the sheet open. */
    onSaveRecipient?: (r: Omit<SavedRecipient, 'id'> & { id?: string }) => Promise<SavedRecipient>;
    /** Remove a saved recipient. The row comes back if this rejects. */
    onRemoveRecipient?: (id: string) => Promise<unknown>;
    onCancel?: () => void;
  }

  let { tokens, value = null, section = 'tokens', onChange, onSetPin, onChangePin, onDisablePin, onSaveRecipient, onRemoveRecipient, onCancel }: Props = $props();
  const t = useT();

  // values in USD, matching the wallet panel's holdings
  const held = $derived(tokens.filter((t) => t.held > 0).map((t) => ({ symbol: t.symbol, mark: t.mark, grad: t.grad, value: Math.round(t.price * t.held) })));

  let tabOverride = $state<Section | null>(null);
  // the dialog's own exit (the sheets' host calls block it, see `pending`)
  const flow = new DialogFlow();
  // the dialog keeps its own copy once anything changes
  // edits made here since the host last sent `value`; a new `value` from the host replaces them
  let local = $state<Partial<WalletSettings>>({});
  $effect.pre(() => {
    void value;
    untrack(() => (local = {}));
  });
  let listOpen = $state(false);
  let query = $state('');
  let recipQuery = $state('');
  // each opened recipient sheet has its own DialogFlow: its save is one call at a time, and only that sheet closes on success
  type Sheet = { editId: string | null; address: string; name: string; token: string | null; flow: DialogFlow };
  let sheet = $state<Sheet | null>(null);
  const openSheet = (s: Omit<Sheet, 'flow'>) => (sheet = { ...s, flow: new DialogFlow() });
  let recipError = $state(false);
  let confirmId = $state<string | null>(null);
  type PinFlow = {
    mode: 'set' | 'change' | 'disable';
    step: 'current' | 'set' | 'confirm';
    value: string;
    /** The current PIN (change / disable), held until the host call. */
    current: string;
    first: string;
    error: null | 'mismatch' | 'rejected' | 'failed';
    busy: boolean;
  };
  let pin = $state<PinFlow | null>(null);
  const PIN_STEPS: Record<PinFlow['mode'], PinFlow['step'][]> = { set: ['set', 'confirm'], change: ['current', 'set', 'confirm'], disable: ['current'] };
  let pinInput = $state<HTMLInputElement>();
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    flow.destroy();
    // a pending typed value still reaches the host
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      onChange?.(settings);
    }
  });

  const settings = $derived<WalletSettings>({
    pinOn: value?.pinOn ?? false,
    autoConfig: value?.autoConfig ?? true,
    minBalance: value?.minBalance ?? '',
    tokens: value?.tokens ?? held.map((t) => t.symbol),
    currency: value?.currency ?? 'USD',
    recipients: value?.recipients ?? [],
    ...local,
  });
  const tab = $derived(tabOverride ?? section);
  const floor = $derived(parseAmount(settings.minBalance || '0'));
  const picked = $derived(settings.tokens);
  const autoOn = $derived(settings.autoConfig !== false);
  const shown = $derived(autoOn ? held.filter((t) => t.value >= floor) : held.filter((t) => picked.includes(t.symbol)));
  const q = $derived(query.trim().toLowerCase());
  const filtered = $derived(q ? held.filter((t) => t.symbol.toLowerCase().includes(q)) : held);

  const saved = $derived(settings.recipients);
  const rq = $derived(recipQuery.trim().toLowerCase());
  const shownRecips = $derived(rq ? saved.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(rq)) : saved);
  const draftAddr = $derived(sheet?.address.trim() ?? '');
  const draftNet = $derived(detect(draftAddr));
  const dupe = $derived(saved.find((r) => r.address === draftAddr && r.id !== sheet?.editId));
  const draftValid = $derived(!!draftNet && draftNet !== 'unknown' && !dupe);

  // apply-as-you-go: every change shows at once and reaches the parent; typing (`defer`) is sent once it pauses
  function apply(patch: Partial<WalletSettings>, defer = false) {
    local = { ...local, ...patch };
    clearTimeout(notifyTimer);
    notifyTimer = undefined;
    if (defer) {
      notifyTimer = setTimeout(() => {
        notifyTimer = undefined;
        onChange?.(settings);
      }, 500);
    } else onChange?.({ ...settings, ...patch });
  }

  // recipients changed through the host's own callbacks: shown here, not re-sent through onChange
  const showRecipients = (recipients: SavedRecipient[]) => (local = { ...local, recipients });

  // a save or PIN call in flight can't be dismissed (sheet, PIN sheet or the whole dialog): its result decides what's next
  // like the wallet panel: USD, plus each currency one of the tokens prices (so the panel can show it); a currency
  // already chosen stays listed so it can be switched away from
  const currencies = $derived(CURRENCIES.filter((c) => c === 'USD' || c === settings.currency || tokens.some((tk) => tk.symbol === c && tk.price > 0)));

  const pending = $derived(!!sheet?.flow.busy || !!pin?.busy);
  const closeSheet = () => {
    if (!sheet?.flow.busy) sheet = null;
  };
  const closePin = () => {
    if (!pin?.busy) pin = null;
  };

  function close() {
    if (pending) return;
    flow.dismiss(onCancel);
  }

  async function saveRecipient() {
    if (!sheet || !draftValid || sheet.flow.locked) return;
    const editId = sheet.editId;
    const fields = { name: sheet.name.trim() || t('ui.walletSettingsDialog.defaultRecipientName', { network: draftNet }), address: draftAddr, token: sheet.token };
    const merge = (entry: SavedRecipient) => (editId ? saved.map((r) => (r.id === editId ? entry : r)) : [...saved, entry]);
    if (!onSaveRecipient) {
      sheet = null;
      apply({ recipients: merge({ id: editId ?? `r${Date.now()}`, ...fields }) });
      return;
    }
    const own = sheet.flow;
    const save = onSaveRecipient;
    const result = await own.run(() => save(editId ? { id: editId, ...fields } : fields));
    if (!result.ok) return; // the sheet stays with its error (own.failed)
    // only the sheet this save belongs to closes
    if (sheet?.flow === own) sheet = null;
    showRecipients(merge(result.value));
  }

  async function removeRecipient(id: string) {
    confirmId = null;
    recipError = false;
    if (!onRemoveRecipient) {
      apply({ recipients: saved.filter((x) => x.id !== id) });
      return;
    }
    // remember the row and where it sat, so a failure puts back only this row and keeps other changes
    const at = saved.findIndex((x) => x.id === id);
    const row = saved[at];
    const prevId = at > 0 ? saved[at - 1].id : null;
    showRecipients(saved.filter((x) => x.id !== id));
    try {
      await onRemoveRecipient(id);
    } catch {
      if (row && !saved.some((x) => x.id === id)) {
        const p = prevId == null ? -1 : saved.findIndex((x) => x.id === prevId);
        const i = prevId == null ? 0 : p >= 0 ? p + 1 : Math.min(at, saved.length);
        showRecipients([...saved.slice(0, i), row, ...saved.slice(i)]);
      }
      recipError = true;
    }
  }

  const startPin = (mode: PinFlow['mode']) => (pin = { mode, step: PIN_STEPS[mode][0], value: '', current: '', first: '', error: null, busy: false });

  function togglePin(on: boolean) {
    startPin(on ? 'set' : 'disable');
  }

  // waits on the host; on success the flow closes and pinOn follows, on rejection `back` decides where the user retries
  async function commitPin(call: () => Promise<unknown> | undefined, pinOn: boolean, back: Partial<PinFlow>) {
    if (!pin) return;
    pin = { ...pin, busy: true, error: null };
    try {
      await call();
      pin = null;
      apply({ pinOn });
    } catch {
      if (pin) pin = { ...pin, busy: false, value: '', ...back };
    }
  }

  function pinNext() {
    if (!pin || pin.busy || pin.value.length !== 6) return;
    const { mode, step, value } = pin;
    if (step === 'current') {
      if (mode === 'disable') commitPin(() => onDisablePin?.(value), false, { error: 'rejected' });
      else pin = { ...pin, step: 'set', current: value, value: '', error: null };
    } else if (step === 'set') pin = { ...pin, step: 'confirm', first: value, value: '', error: null };
    else if (value !== pin.first) pin = { ...pin, value: '', error: 'mismatch' };
    else if (mode === 'change') {
      const current = pin.current;
      // a wrong current PIN sends the user back to the first step
      commitPin(() => onChangePin?.(current, value), true, { step: 'current', current: '', first: '', error: 'rejected' });
    } else commitPin(() => onSetPin?.(value), true, { error: 'failed' });
  }

  function pinBack() {
    if (!pin || pin.busy) return;
    const steps = PIN_STEPS[pin.mode];
    const i = steps.indexOf(pin.step);
    if (i > 0) pin = { ...pin, step: steps[i - 1], value: '', error: null };
  }

  // keep the hidden PIN input focused while the sheet is open
  $effect(() => {
    if (!pin || !pinInput) return;
    void pin.value;
    void pin.step;
    void pin.error;
    void pin.busy;
    tick().then(() => {
      if (pinInput && document.activeElement !== pinInput) pinInput.focus();
    });
  });
</script>

{#snippet glyph(name: string, size: number, ink: string)}<span class="glyph" style:width="{size}px" style:height="{size}px" style:background={ink} style:mask="var(--icon-{name}) center/contain no-repeat"
  ></span>{/snippet}

{#snippet sheetHeader(title: string, sub: string, mono: boolean, onClose: () => void, onBack?: () => void)}
  <div class="sheet-head">
    {#if onBack}
      <span class="square back" onclick={onBack} role="button" tabindex="0">{@render glyph('back', 15, 'var(--ink-2,#C9C9D4)')}</span>
    {/if}
    <div class="sheet-titles">
      <span class="sheet-title">{title}</span>
      <span class="sheet-sub" class:mono>{sub}</span>
    </div>
    <span class="square small" onclick={onClose} role="button" tabindex="0">{@render glyph('close', 14, 'var(--ink-3,#9A9AA8)')}</span>
  </div>
{/snippet}

<div class="layer" class:closing={flow.closing} data-screen-label="Wallet settings" role="dialog" aria-modal="true" use:modal={flow.closing ? undefined : close}>
  <div class="veil" class:closing={flow.closing} onclick={close} aria-hidden="true"></div>

  <div class="card" class:closing={flow.closing}>
    <div class="header">
      <div class="header-text">
        <span class="header-title">{t('ui.walletSettingsDialog.title')}</span>
        <span class="header-sub">{t('ui.walletSettingsDialog.subtitle')}</span>
      </div>
      <span class="square" onclick={close} role="button" tabindex="0">{@render glyph('close', 15, 'var(--ink-3,#9A9AA8)')}</span>
    </div>

    <div class="main">
      <div class="nav">
        {#each NAV as n}
          <span class="nav-item" class:on={tab === n.key} onclick={() => (tabOverride = n.key)} role="button" tabindex="0">
            {@render glyph(n.icon, 16, 'var(--nav-ink)')}
            <span class="nav-label">{t(n.label)}</span>
          </span>
        {/each}
      </div>

      <div class="content">
        {#if tab === 'tokens'}
          <div class="setting">
            <div class="setting-text">
              <span class="setting-title">{t('ui.walletSettingsDialog.autoConfig')}</span>
              <span class="setting-desc">{t(autoOn ? 'ui.walletSettingsDialog.autoConfigOn' : 'ui.walletSettingsDialog.autoConfigOff')}</span>
            </div>
            <div class="setting-toggle">
              <Toggle
                on={autoOn}
                onChange={(on) => apply({ autoConfig: on, tokens: on ? picked : held.filter((t) => t.value >= floor).map((t) => t.symbol) })}
              />
            </div>
          </div>

          {#if autoOn}
            <div class="minimum">
              <span class="eyebrow grow">{t('ui.walletSettingsDialog.minimumValue')}</span>
              <div class="money-field">
                <span class="dollar">$</span>
                <input
                  value={settings.minBalance}
                  oninput={(e) => apply({ minBalance: cleanAmount(e.currentTarget.value).replace(',', '.') }, true)}
                  placeholder="0"
                  inputmode="decimal"
                />
              </div>
            </div>
          {/if}

          <div
            class="list-card"
            onclick={() => {
              listOpen = true;
              query = '';
            }}
            role="button"
            tabindex="0"
          >
            <div class="list-card-head">
              <div class="list-card-text">
                <span class="list-card-title">{t('ui.walletSettingsDialog.tokenList')}</span>
                <span class="list-card-sub"
                  >{t(autoOn ? 'ui.walletSettingsDialog.shownByMinimum' : 'ui.walletSettingsDialog.shownByYou', { shown: autoOn ? shown.length : picked.length, total: held.length })}</span
                >
              </div>
              {@render glyph('chevron-right', 14, 'var(--ink-4,#7C7C8C)')}
            </div>
            <div class="chips">
              {#each shown.slice(0, CHIP_CAP) as c}
                <span class="chip"><span class="chip-mark" style:background={c.grad}>{c.mark}</span><span class="chip-symbol">{c.symbol}</span></span>
              {/each}
              {#if shown.length > CHIP_CAP}
                <span class="chip-more">{t('ui.walletSettingsDialog.moreChips', { count: shown.length - CHIP_CAP })}</span>
              {/if}
              {#if shown.length === 0}
                <span class="none">{t('ui.walletSettingsDialog.nothingSelected')}</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if tab === 'security'}
          <div class="setting">
            <div class="setting-text">
              <div class="pin-head">
                <span class="setting-title">{t('ui.walletSettingsDialog.pinOnTransfers')}</span>
                <span class="pin-badge" class:set={settings.pinOn}
                  >{@render glyph(settings.pinOn ? 'check' : 'lock', 10, 'var(--badge-ink)')}<span class="pin-badge-label">{t(settings.pinOn ? 'ui.walletSettingsDialog.pinSet' : 'ui.walletSettingsDialog.pinNotSet')}</span></span
                >
              </div>
              <span class="setting-desc"
                >{t(settings.pinOn ? 'ui.walletSettingsDialog.pinOnDesc' : 'ui.walletSettingsDialog.pinOffDesc')}</span
              >
            </div>
            <!-- on follows the open sheet too, so cancelling a sheet puts the switch back -->
            <div class="setting-toggle">
              <Toggle
                on={settings.pinOn ? pin?.mode !== 'disable' : pin?.mode === 'set'}
                disabled={settings.pinOn ? !onDisablePin : !onSetPin}
                onChange={togglePin}
              />
            </div>
          </div>
          {#if settings.pinOn && onChangePin}
            <span class="change-pin" onclick={() => startPin('change')} role="button" tabindex="0">
              <span class="change-pin-label">{t('ui.walletSettingsDialog.changePin')}</span>
              {@render glyph('lock', 14, 'var(--accent,#FF5672)')}
            </span>
          {/if}
        {/if}

        {#if tab === 'currency'}
          <span class="eyebrow">{t('ui.walletSettingsDialog.showValuesIn')}</span>
          <div class="currencies">
            {#each currencies as c}
              {@const on = settings.currency === c}
              <span class="currency" class:on onclick={() => apply({ currency: c })} role="button" tabindex="0">
                <span class="currency-code">{c}</span>
                <span class="currency-note">{c === 'USD' ? t('ui.walletSettingsDialog.currencyDefault') : t('ui.walletSettingsDialog.pricedFrom', { currency: c })}</span>
                {@render glyph('check', 16, on ? 'var(--accent,#FF5672)' : 'transparent')}
              </span>
            {/each}
          </div>
        {/if}

        {#if tab === 'recipients'}
          <div class="recipients">
            <div class="recipients-head">
              <div class="setting-text">
                <span class="setting-title">{t('ui.walletSettingsDialog.savedRecipients')}</span>
                <span class="setting-desc">{t('ui.walletSettingsDialog.savedRecipientsDesc')}</span>
              </div>
              <span
                class="add"
                onclick={() => {
                  openSheet({ editId: null, address: '', name: '', token: null });
                  confirmId = null;
                }}
                role="button"
                tabindex="0">{@render glyph('plus', 13, 'var(--on-accent,#2E0512)')}<span class="add-label">{t('ui.common.add')}</span></span
              >
            </div>

            {#if saved.length > 5}
              <div class="search">
                {@render glyph('search', 14, 'var(--ink-4,#7C7C8C)')}
                <input bind:value={recipQuery} placeholder={t('ui.walletSettingsDialog.searchRecipients')} />
              </div>
            {/if}

            {#if recipError}
              <span class="recip-error" role="alert">{t('ui.walletSettingsDialog.removeFailed')}</span>
            {/if}
            <div class="recipient-list">
              {#each shownRecips as r}
                {@const net = detect(r.address)}
                {@const tok = r.token ? held.find((t) => t.symbol === r.token) : undefined}
                <div class="recipient">
                  <span class="recipient-mark" class:token={!!tok} style:background={tok ? tok.grad : 'var(--overlay-2,rgba(255,255,255,.1))'}
                    >{tok ? tok.mark : (r.name || '?').trim().charAt(0).toUpperCase()}</span
                  >
                  <div class="recipient-text">
                    <div class="recipient-line">
                      <span class="recipient-name">{r.name}</span>
                      <span class="recipient-badge">{r.token ? r.token : net === 'unknown' ? t('ui.walletSettingsDialog.unknownNetwork') : net}</span>
                    </div>
                    <span class="recipient-address">{shortAddr(r.address)}</span>
                  </div>
                  {#if confirmId === r.id}
                    <div class="confirm">
                      <span class="keep" onclick={() => (confirmId = null)} role="button" tabindex="0">{t('ui.walletSettingsDialog.keep')}</span>
                      <span
                        class="remove"
                        onclick={() => removeRecipient(r.id)}
                        role="button"
                        tabindex="0">{t('ui.common.remove')}</span
                      >
                    </div>
                  {:else}
                    <div class="row-actions">
                      <span
                        class="square"
                        onclick={() => {
                          openSheet({ editId: r.id, address: r.address, name: r.name, token: r.token ?? null });
                          confirmId = null;
                        }}
                        role="button"
                        tabindex="0"
                        aria-label={t('ui.walletSettingsDialog.editRecipient')}
                        title={t('ui.walletSettingsDialog.editRecipient')}>{@render glyph('edit', 15, 'var(--ink-3,#9A9AA8)')}</span
                      >
                      <span class="square" onclick={() => (confirmId = r.id)} role="button" tabindex="0" aria-label={t('ui.walletSettingsDialog.removeRecipient')} title={t('ui.walletSettingsDialog.removeRecipient')}
                        >{@render glyph('trash', 15, 'var(--ink-3,#9A9AA8)')}</span
                      >
                    </div>
                  {/if}
                </div>
              {/each}

              {#if shownRecips.length === 0}
                <div class="recipients-empty">
                  {@render glyph('users', 22, 'var(--ink-4,#7C7C8C)')}
                  <span class="recipients-empty-text"
                    >{saved.length === 0 ? t('ui.walletSettingsDialog.noRecipients') : t('ui.walletSettingsDialog.noRecipientMatch', { query: recipQuery.trim() })}</span
                  >
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="footer">
      <span class="footer-note">{t('ui.walletSettingsDialog.footerNote', { currency: settings.currency })}</span>
      <div class="done" onclick={close} role="button" tabindex="0">{t('ui.common.done')}</div>
    </div>

    {#if listOpen}
      <div class="sheet-layer">
        <div class="sheet-veil dim" onclick={() => (listOpen = false)} aria-hidden="true"></div>
        <div class="sheet list-sheet">
          {@render sheetHeader(t('ui.walletSettingsDialog.tokenList'), t(autoOn ? 'ui.walletSettingsDialog.setAutomatically' : 'ui.walletSettingsDialog.youChoose'), false, () => (listOpen = false))}

          <div class="list-search-wrap">
            <div class="search tall">
              {@render glyph('search', 15, 'var(--ink-4,#7C7C8C)')}
              <input bind:value={query} placeholder={t('ui.walletSettingsDialog.searchTokens')} />
              {#if query.length > 0}
                <span class="clear" onclick={() => (query = '')} role="button" tabindex="0">{@render glyph('close', 11, 'var(--ink-3,#9A9AA8)')}</span>
              {/if}
            </div>
          </div>

          <div class="sheet-body list-body">
            {#if autoOn}
              <div class="take-over">
                <span class="take-over-text">{t('ui.walletSettingsDialog.takeOverText')}</span>
                <span class="take-over-button" onclick={() => apply({ autoConfig: false, tokens: held.filter((t) => t.value >= floor).map((t) => t.symbol) })} role="button" tabindex="0"
                  >{t('ui.walletSettingsDialog.takeOver')}</span
                >
              </div>
            {/if}

            <div class="token-rows">
              {#each filtered as tk}
                {@const on = autoOn ? tk.value >= floor : picked.includes(tk.symbol)}
                <div
                  class="token-row"
                  class:on
                  class:locked={autoOn}
                  class:dimmed={autoOn && !on}
                  onclick={autoOn ? undefined : () => apply({ tokens: on ? picked.filter((x) => x !== tk.symbol) : [...picked, tk.symbol] })}
                  role="button"
                  tabindex="0"
                >
                  <span class="token-mark" style:background={tk.grad}>{tk.mark}</span>
                  <div class="token-text">
                    <span class="token-symbol">{tk.symbol}</span>
                    <span class="token-value">{money(tk.value)}</span>
                  </div>
                  {@render glyph(on ? 'check' : 'circle', 18, on ? 'var(--accent,#FF5672)' : 'var(--line-2,rgba(255,255,255,.14))')}
                </div>
              {/each}
              {#if filtered.length === 0}
                <span class="no-rows">{t('ui.walletSettingsDialog.noTokenMatch', { query: query.trim() })}</span>
              {/if}
            </div>
          </div>

          <div class="sheet-foot">
            <span class="sheet-foot-note" class:warn={!autoOn && picked.length === 0}
              >{autoOn ? t('ui.walletSettingsDialog.followsMinimum', { amount: money(floor) }) : picked.length === 0 ? t('ui.walletSettingsDialog.pickAtLeastOne') : t('ui.walletSettingsDialog.appliedAsYouPick')}</span
            >
            <div class="done small" onclick={() => (listOpen = false)} role="button" tabindex="0">{t('ui.common.done')}</div>
          </div>
        </div>
      </div>
    {/if}

    {#if pin}
      {@const confirmStep = pin.step === 'confirm'}
      {@const currentStep = pin.step === 'current'}
      {@const steps = PIN_STEPS[pin.mode]}
      {@const ready = pin.value.length === 6 && !pin.busy}
      <div class="sheet-layer pin-layer">
        <div class="sheet-veil" onclick={closePin} aria-hidden="true"></div>
        <div class="sheet pin-sheet">
          {@render sheetHeader(
            t(
              currentStep
                ? 'ui.walletSettingsDialog.currentPin'
                : confirmStep
                  ? 'ui.walletSettingsDialog.confirmPin'
                  : pin.mode === 'set'
                    ? 'ui.walletSettingsDialog.setUpPin'
                    : 'ui.walletSettingsDialog.chooseNewPin',
            ),
            steps.length > 1 ? t('ui.walletSettingsDialog.step', { step: steps.indexOf(pin.step) + 1, total: steps.length }) : '',
            true,
            closePin,
            steps.indexOf(pin.step) > 0 ? pinBack : undefined,
          )}

          <div class="sheet-body">
            <span class="pin-blurb"
              >{t(
                currentStep
                  ? pin.mode === 'disable'
                    ? 'ui.walletSettingsDialog.disablePinBlurb'
                    : 'ui.walletSettingsDialog.currentPinBlurb'
                  : confirmStep
                    ? 'ui.walletSettingsDialog.pinConfirmBlurb'
                    : 'ui.walletSettingsDialog.pinBlurb',
              )}</span
            >
            <div class="pin-pad" onclick={() => pinInput?.focus()} role="button" tabindex="0">
              <div class="pin-digits">
                {#each [0, 1, 2, 3, 4, 5] as i}
                  <span class="pin-digit" class:filled={pin.value.length >= i} class:error={!!pin.error}>{pin.value.length > i ? '•' : ''}</span>
                {/each}
                <input
                  class="pin-input"
                  bind:this={pinInput}
                  value={pin.value}
                  oninput={(e) => (pin = pin && { ...pin, value: e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 6), error: null })}
                  onkeydown={(e) => e.key === 'Enter' && pinNext()}
                  type="password"
                  inputmode="numeric"
                  autocomplete="off"
                  maxlength="6"
                  disabled={pin.busy}
                  aria-label={t(currentStep ? 'ui.walletSettingsDialog.currentPin' : confirmStep ? 'ui.walletSettingsDialog.confirmPin' : 'ui.walletSettingsDialog.setUpPin')}
                />
              </div>
              <span class="pin-note" class:error={!!pin.error} role={pin.error ? 'alert' : undefined}
                >{t(
                  pin.error === 'mismatch'
                    ? 'ui.walletSettingsDialog.pinMismatch'
                    : pin.error === 'rejected'
                      ? 'ui.walletSettingsDialog.pinRejected'
                      : pin.error === 'failed'
                        ? 'ui.walletSettingsDialog.pinSaveFailed'
                        : 'ui.walletSettingsDialog.numbersOnly',
                )}</span
              >
            </div>
          </div>

          <div class="sheet-foot">
            <span class="cancel" onclick={closePin} role="button" tabindex="0" aria-disabled={pin.busy}>{t('ui.common.cancel')}</span>
            <span class="grow"></span>
            <div class="primary" class:ready onclick={pinNext} role="button" tabindex="0">
              <span
                >{t(
                  pin.busy
                    ? 'ui.walletSettingsDialog.saving'
                    : pin.mode === 'disable'
                      ? 'ui.walletSettingsDialog.turnOffPin'
                      : confirmStep
                        ? 'ui.walletSettingsDialog.savePin'
                        : 'ui.common.continue',
                )}</span
              >
              {@render glyph(confirmStep || pin.mode === 'disable' ? 'lock' : 'arrow', 15, 'var(--primary-ink)')}
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if sheet}
      <div class="sheet-layer recipient-layer">
        <div class="sheet-veil" onclick={closeSheet} aria-hidden="true"></div>
        <div class="sheet recipient-sheet">
          {@render sheetHeader(t(sheet.editId ? 'ui.walletSettingsDialog.editRecipient' : 'ui.walletSettingsDialog.addRecipient'), t('ui.walletSettingsDialog.networkDetected'), false, closeSheet)}

          <div class="sheet-body">
            <div class="form-field">
              <span class="eyebrow small">{t('ui.walletSettingsDialog.address')}</span>
              <textarea
                class="address-input"
                class:valid={draftValid}
                class:invalid={!!draftAddr && !draftValid}
                value={sheet.address}
                oninput={(e) => (sheet = sheet && { ...sheet, address: e.currentTarget.value })}
                placeholder={t('ui.walletSettingsDialog.addressPlaceholder')}
                rows="2"
              ></textarea>
              {#if draftAddr}
                <div class="address-note" class:valid={draftValid}>
                  {@render glyph(draftValid ? 'check' : 'warning', 14, 'var(--note-ink)')}
                  <span class="address-note-text"
                    >{dupe
                      ? t('ui.walletSettingsDialog.alreadySaved', { name: dupe.name })
                      : draftNet === 'unknown'
                        ? t('ui.walletSettingsDialog.unrecognisedAddress')
                        : t('ui.walletSettingsDialog.addressDetected', { network: draftNet })}</span
                  >
                </div>
              {/if}
            </div>

            <div class="form-field">
              <span class="eyebrow small">{t('ui.walletSettingsDialog.name')}</span>
              <input
                class="name-input"
                value={sheet.name}
                oninput={(e) => (sheet = sheet && { ...sheet, name: e.currentTarget.value })}
                placeholder={draftValid ? t('ui.walletSettingsDialog.defaultRecipientName', { network: draftNet }) : t('ui.walletSettingsDialog.namePlaceholder')}
              />
              <span class="field-hint">{t('ui.walletSettingsDialog.nameHint')}</span>
            </div>

            <div class="form-field">
              <span class="eyebrow small">{t('ui.walletSettingsDialog.restrictToken')} <span class="optional">{t('ui.walletSettingsDialog.optional')}</span></span>
              <div class="token-chips">
                {#each [{ symbol: null, label: t('ui.walletSettingsDialog.anyToken'), mark: '', grad: 'transparent' }, ...held.map((t) => ({ symbol: t.symbol, label: t.symbol, mark: t.mark, grad: t.grad }))] as c}
                  <span class="token-chip" class:on={sheet.token === c.symbol} class:dotted={!!c.symbol} onclick={() => (sheet = sheet && { ...sheet, token: c.symbol })} role="button" tabindex="0">
                    {#if c.symbol}
                      <span class="token-chip-mark" style:background={c.grad}>{c.mark}</span>
                    {/if}
                    <span class="token-chip-label">{c.label}</span>
                  </span>
                {/each}
              </div>
              <span class="field-hint wrap"
                >{sheet.token ? t('ui.walletSettingsDialog.restrictHint', { token: sheet.token }) : t('ui.walletSettingsDialog.anyTokenHint')}</span
              >
            </div>
          </div>

          <div class="sheet-foot">
            <span class="cancel" onclick={closeSheet} role="button" tabindex="0" aria-disabled={sheet.flow.busy}>{t('ui.common.cancel')}</span>
            <span class="grow"></span>
            {#if sheet.flow.failed}<span class="recip-error" role="alert">{t('ui.walletSettingsDialog.saveRecipientFailed')}</span>{/if}
            <div class="primary" class:ready={draftValid && !sheet.flow.busy} onclick={saveRecipient} role="button" tabindex="0" aria-disabled={!draftValid || sheet.flow.busy}>
              <span>{t(sheet.flow.busy ? 'ui.walletSettingsDialog.saving' : sheet.editId ? 'ui.common.saveChanges' : 'ui.walletSettingsDialog.saveRecipient')}</span>
              {@render glyph('check', 15, 'var(--primary-ink)')}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .layer.closing {
    pointer-events: none;
  }

  .veil.closing {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 680px;
    height: 606px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .card.closing {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .glyph {
    flex: none;
  }

  .grow {
    flex: 1;
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-22);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .header-text,
  .sheet-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .header-sub,
  .sheet-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .sheet-sub.mono {
    font-family: var(--font-mono);
  }

  .square {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .square.small {
    width: 28px;
    height: 28px;
  }

  .square.back {
    width: 32px;
    height: 32px;
  }

  .square:hover,
  .clear:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .main {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }

  .nav {
    flex: none;
    width: 196px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-14) var(--space-10);
    border-inline-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .nav-item {
    --nav-ink: var(--ink-3, #9a9aa8);
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 40px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .nav-item.on {
    --nav-ink: var(--ink, #ececf1);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .nav-item:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .nav-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--nav-ink);
  }

  .on .nav-label {
    font-weight: var(--weight-semibold);
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
    padding: var(--space-26) var(--space-22);
  }

  .setting {
    flex: none;
    display: flex;
    align-items: flex-start;
    gap: var(--space-16);
  }

  .setting-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .setting-title {
    font: var(--weight-bold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .setting-desc {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .setting-toggle {
    flex: none;
    margin-block-start: 2px;
  }

  .eyebrow {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .eyebrow.grow {
    min-width: 0;
  }

  .eyebrow.small {
    font-size: var(--text-xs);
  }

  .optional {
    color: var(--ink-4, #6e6e7c);
  }

  .minimum {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .money-field {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    width: 140px;
    padding: 0 var(--space-14);
    height: 40px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .dollar {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .money-field input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .list-card {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    cursor: pointer;
  }

  .list-card:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .list-card-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .list-card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .list-card-title {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .list-card-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
  }

  .chip {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 26px;
    padding: 0 var(--space-8) 0 3px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .chip-mark,
  .token-chip-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    font: var(--weight-bold) 9px/1 var(--font-sans);
    color: #0b0b0f;
  }

  .chip-symbol {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .chip-more {
    flex: none;
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .none {
    font: var(--weight-regular) var(--text-sm) / 1.6 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .recip-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .pin-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex-wrap: wrap;
  }

  .pin-badge {
    --badge-ink: var(--ink-4, #7c7c8c);
    flex: none;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    padding: 0 var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .pin-badge.set {
    --badge-ink: var(--status-online, #2ee6a8);
    background: var(--category-b-soft, rgba(46, 230, 168, 0.12));
  }

  .pin-badge-label {
    font: var(--weight-semibold) 10.5px/1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--badge-ink);
  }

  .change-pin {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 40px;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .change-pin:hover,
  .take-over-button:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
  }

  .change-pin-label {
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .currencies {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    margin-block-start: calc(-1 * var(--space-22));
  }

  .currency {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: 44px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .currency.on {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .currency:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .currency-code {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .currency-note {
    flex: none;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .recipients {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    margin-block-end: calc(-1 * var(--space-32));
  }

  .recipients-head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
  }

  .add {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 34px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .add:hover {
    filter: brightness(1.08);
  }

  .add-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 40px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .search.tall {
    height: 42px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .clear {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .recipient-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .recipient {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 58px;
    padding: var(--space-8) var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .recipient:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .recipient-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-pill);
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .recipient-mark.token {
    color: #0b0b0f;
  }

  .recipient-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .recipient-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .recipient-name {
    flex: none;
    max-width: 190px;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipient-badge {
    flex: none;
    display: flex;
    align-items: center;
    height: 18px;
    padding: 0 var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold) 10px/1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-2, #c9c9d4);
  }

  .recipient-address {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-actions {
    flex: none;
    display: flex;
    gap: 2px;
  }

  .confirm {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .keep,
  .remove {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .keep:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .remove {
    background: var(--status-danger, #f5493d);
    color: #2b0704;
  }

  .remove:hover {
    filter: brightness(1.08);
  }

  .recipients-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-32) var(--space-22);
    border-radius: var(--radius-lg);
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .recipients-empty-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-align: center;
    text-wrap: pretty;
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-22);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .footer-note {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .done {
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 var(--space-18);
    height: 38px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .done:not(.small):hover {
    filter: brightness(1.15);
  }

  .done.small {
    padding: 0 var(--space-16);
    height: 36px;
  }

  /* sheets over the card */
  .sheet-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .sheet-layer.pin-layer {
    z-index: 6;
  }

  .sheet-layer.recipient-layer {
    z-index: 7;
  }

  .sheet-veil {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    animation: oc-veil-in 160ms ease-out both;
  }

  .sheet-veil.dim {
    background: rgba(3, 3, 6, 0.66);
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #15151b);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)),
      0 24px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: oc-sheet-in 200ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
  }

  .list-sheet {
    max-width: 420px;
    height: 100%;
  }

  .pin-sheet {
    max-width: 392px;
  }

  .recipient-sheet {
    max-width: 440px;
  }

  .sheet-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .sheet-title {
    font: var(--weight-bold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
    padding: var(--space-22) var(--space-18);
  }

  .sheet-body.list-body {
    gap: var(--space-12);
    padding: var(--space-14) var(--space-18) var(--space-18);
  }

  .sheet-foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-14) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .list-sheet .sheet-foot {
    gap: var(--space-12);
  }

  .sheet-foot-note {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .sheet-foot-note.warn {
    color: var(--status-danger, #f5493d);
  }

  .list-search-wrap {
    flex: none;
    padding: var(--space-14) var(--space-18) 0;
  }

  .take-over {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .take-over-text {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .take-over-button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .token-rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: 52px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
    transition: background 160ms ease-out;
  }

  .token-row.on {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .token-row.locked {
    cursor: default;
  }

  .token-row.dimmed {
    opacity: 0.45;
  }

  .token-row:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .token-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
    color: #0b0b0f;
  }

  .token-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .token-symbol {
    font: var(--weight-bold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-value {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .no-rows {
    padding: var(--space-14) var(--space-12);
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .pin-blurb {
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .pin-pad {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-22) var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    cursor: text;
  }

  .pin-digits {
    position: relative;
    display: flex;
    gap: var(--space-8);
  }

  .pin-digit {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: 34px;
    height: 42px;
    box-sizing: border-box;
    padding-block-end: var(--space-6);
    border-block-end: 2px solid var(--line-2, rgba(255, 255, 255, 0.14));
    font: var(--weight-bold) var(--text-xl, 20px) / 1 var(--font-mono);
    color: var(--ink, #ececf1);
    transition: border-color 160ms ease-out;
  }

  .pin-digit.filled {
    border-block-end-color: var(--accent, #ff5672);
  }

  .pin-digit.error {
    border-block-end-color: var(--status-danger, #f5493d);
  }

  .pin-input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    border: 0;
    outline: none;
    background: none;
    caret-color: transparent;
    cursor: text;
  }

  .pin-note {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .pin-note.error {
    color: var(--status-danger, #f5493d);
  }

  .cancel {
    flex: none;
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .primary {
    --primary-ink: var(--ink-4, #7c7c8c);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-16);
    height: 38px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--primary-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .primary.ready {
    --primary-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
    cursor: pointer;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .address-input {
    width: 100%;
    box-sizing: border-box;
    resize: none;
    padding: var(--space-12) var(--space-14);
    border: 0;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    font: var(--weight-medium) var(--text-md) / 1.5 var(--font-mono);
    color: var(--ink, #ececf1);
    word-break: break-all;
  }

  .address-input.valid {
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .address-input.invalid {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .address-note {
    --note-ink: var(--status-danger, #f5493d);
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    background: var(--status-danger-soft, rgba(245, 73, 61, 0.12));
  }

  .address-note.valid {
    --note-ink: var(--status-online, #2ee6a8);
    background: var(--category-b-soft, rgba(46, 230, 168, 0.12));
  }

  .address-note-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--note-ink);
    text-wrap: pretty;
  }

  .name-input {
    width: 100%;
    box-sizing: border-box;
    height: 44px;
    padding: 0 var(--space-14);
    border: 0;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .field-hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .field-hint.wrap {
    line-height: 1.45;
    text-wrap: pretty;
  }

  .token-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
  }

  .token-chip {
    --chip-ink: var(--ink-2, #c9c9d4);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 32px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    cursor: pointer;
    user-select: none;
  }

  .token-chip.dotted {
    padding: 0 var(--space-10) 0 4px;
  }

  .token-chip.on {
    --chip-ink: var(--accent, #ff5672);
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .token-chip:hover {
    filter: brightness(1.15);
  }

  .token-chip-mark {
    width: 22px;
    height: 22px;
  }

  .token-chip-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--chip-ink);
  }
</style>
