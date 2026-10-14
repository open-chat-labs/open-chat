<!-- Saved recipients, shown in the wallet's main area (opened from the panel ⋯ → Manage recipients).
     List: search, Add recipient, rows with network + optional token lock, quick Send, ⋯ (Edit / Copy address / Remove).
     Add / Edit run in place in the same column. onChange(list) on every save/remove; onSend(recipient) hands off to Send.
     The list is local once edited; a parent that passes new `recipients` replaces it. -->
<script lang="ts" module>
  export interface Recipient {
    id: string;
    name: string;
    address: string;
    /** Only this token can be sent here. */
    token?: string | null;
    /** e.g. "Sent 3 days ago". */
    last?: string;
  }

  export type RecipientNetwork = 'BTC' | 'ETH' | 'XRP' | 'ICP';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import { useT } from '../../lib/i18n';

  const NETWORKS: { id: RecipientNetwork; test: (a: string) => boolean }[] = [
    { id: 'BTC', test: (a) => /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a) },
    { id: 'ETH', test: (a) => /^0x[0-9a-fA-F]{40}$/.test(a) },
    { id: 'XRP', test: (a) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) },
    { id: 'ICP', test: (a) => /^([a-z0-9]{5}-){4,10}[a-z0-9]{3}$/.test(a) || /^[0-9a-f]{64}$/.test(a) },
  ];
  const detect = (a: string): RecipientNetwork | 'unknown' | null => {
    const v = (a || '').trim();
    if (!v) return null;
    return NETWORKS.find((n) => n.test(v))?.id ?? 'unknown';
  };
  const NET_NAME: Record<RecipientNetwork, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP Ledger', ICP: 'Internet Computer' };
  const short = (a: string) => ((a || '').length > 26 ? `${a.slice(0, 12)}…${a.slice(-8)}` : a);
  const GRADS = [
    'linear-gradient(140deg,#FF9F45,#FF5672)',
    'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    'linear-gradient(140deg,#B48CFF,#6A5CFF)',
    'linear-gradient(140deg,#FFC94D,#FF9F45)',
    'linear-gradient(140deg,#7FD1FF,#5C7CFF)',
    'linear-gradient(140deg,#9AA6B8,#5B6577)',
  ];
  const gradFor = (s: string) => {
    let h = 0;
    for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) | 0;
    return GRADS[Math.abs(h) % GRADS.length];
  };
  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;

  interface Props {
    /** Held tokens are offered as token locks. */
    tokens: WalletToken[];
    recipients?: Recipient[];
    onChange?: (list: Recipient[]) => void;
    onSend?: (recipient: Recipient & { network: RecipientNetwork | 'unknown' | null }) => void;
    onClose?: () => void;
  }

  let { tokens, recipients = [], onChange, onSend, onClose }: Props = $props();
  const t = useT();

  // local edits stick until the parent sends a new list
  let list = $derived(recipients);
  let query = $state('');
  let menuFor = $state<string | null>(null);
  let confirmFor = $state<string | null>(null);
  let copiedFor = $state<string | null>(null);
  let form = $state<{ id: string | null; address: string; name: string; token: string | null } | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(copyTimer));

  const held = $derived(tokens.filter((tok) => tok.held > 0));
  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(needle ? list.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(needle)) : list);

  const addr = $derived(form ? form.address.trim() : '');
  const net = $derived(form ? detect(addr) : null);
  const dupe = $derived(form ? list.find((r) => r.address === addr && r.id !== form?.id) : undefined);
  const valid = $derived(!!net && net !== 'unknown' && !dupe);
  const note = $derived(
    !addr ? '' : dupe ? t('ui.walletRecipients.alreadySaved', { name: dupe.name }) : net === 'unknown' ? t('ui.walletRecipients.unsupported') : t('ui.walletRecipients.networkAddress', { network: NET_NAME[net as RecipientNetwork] }),
  );
  // labels are resource keys (token symbols render as themselves)
  const chips = $derived([{ symbol: null as string | null, label: 'ui.walletRecipients.anyToken', mark: '', grad: 'transparent' }].concat(held.map((tok) => ({ symbol: tok.symbol, label: tok.symbol, mark: tok.mark, grad: tok.grad }))));

  function commit(next: Recipient[]) {
    list = next;
    onChange?.(next);
  }

  function back() {
    if (form) form = null;
    else onClose?.();
  }

  function copyAddress(r: Recipient) {
    try {
      navigator.clipboard.writeText(r.address);
    } catch {}
    clearTimeout(copyTimer);
    menuFor = null;
    copiedFor = r.id;
    copyTimer = setTimeout(() => (copiedFor = null), 1600);
  }

  function save() {
    if (!valid || !form) return;
    const name = form.name.trim() || t('ui.walletRecipients.defaultName', { network: NET_NAME[net as RecipientNetwork] });
    const f = form;
    const next = f.id
      ? list.map((r) => (r.id === f.id ? { ...r, name, address: addr, token: f.token } : r))
      : [...list, { id: `r${Date.now()}`, name, address: addr, token: f.token, last: '' }];
    form = null;
    commit(next);
  }
</script>

<div class="recipients" data-screen-label="Wallet recipients">
  <PageHeader title={t(form ? (form.id ? 'ui.walletRecipients.editRecipient' : 'ui.walletRecipients.addRecipient') : 'ui.walletRecipients.title')} onBack={back} backLabel={t(form ? 'ui.walletRecipients.backToRecipients' : 'ui.walletRecipients.backToWallet')} />
  <div class="scroll">
    <div class="column">
      {#if !form}
        <div class="toolbar">
          <div class="search">
            <span class="search-icon"></span>
            <input bind:value={query} placeholder={t('ui.walletRecipients.searchPlaceholder')} aria-label={t('ui.walletRecipients.searchLabel')} />
          </div>
          <span
            class="add"
            onclick={() => {
              form = { id: null, address: '', name: '', token: null };
              menuFor = null;
              confirmFor = null;
            }}
            role="button"
            tabindex="0"
          >
            <span class="add-icon"></span>
            <span class="add-label">{t('ui.walletRecipients.addRecipient')}</span>
          </span>
        </div>

        <div class="list">
          {#each shown as r (r.id)}
            {@const network = detect(r.address)}
            {@const open = menuFor === r.id}
            <div class="row">
              <span class="initial" style:background={gradFor(r.name)}>{(r.name || '?').trim().charAt(0).toUpperCase()}</span>
              <div class="row-body">
                <div class="row-head">
                  <span class="name">{r.name}</span>
                  <span class="net">{network === 'unknown' ? t('ui.walletRecipients.unknownNetwork') : network}</span>
                  {#if r.token}<span class="lock" title={t('ui.walletRecipients.lockTitle', { token: r.token })}><span class="lock-icon"></span>{r.token}</span>{/if}
                </div>
                <div class="row-meta">
                  <span class="address" class:copied={copiedFor === r.id}>{copiedFor === r.id ? t('ui.walletRecipients.addressCopied') : short(r.address)}</span><span class="last">· {r.last || t('ui.walletRecipients.neverSent')}</span>
                </div>
              </div>
              {#if confirmFor !== r.id}
                <span class="send" onclick={() => onSend?.({ network, ...r })} role="button" tabindex="0" aria-label={t('ui.walletRecipients.sendTo', { name: r.name })}><span class="send-icon"></span>{t('ui.common.send')}</span>
                <span
                  class="options"
                  class:open
                  onclick={(e) => {
                    e.preventDefault();
                    menuFor = open ? null : r.id;
                  }}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    menuFor = open ? null : r.id;
                  }}
                  role="button"
                  tabindex="0"
                  aria-label={t('ui.walletRecipients.options')}
                  aria-expanded={open}><span class="options-icon"></span></span
                >
              {:else}
                <span class="confirm-label">{t('ui.walletRecipients.removeConfirm')}</span>
                <span class="cancel" onclick={() => (confirmFor = null)} role="button" tabindex="0">{t('ui.common.cancel')}</span>
                <span
                  class="remove"
                  onclick={() => {
                    confirmFor = null;
                    commit(list.filter((x) => x.id !== r.id));
                  }}
                  role="button"
                  tabindex="0">{t('ui.common.remove')}</span
                >
              {/if}
              {#if open}
                <div class="menu-away" onclick={() => (menuFor = null)} role="presentation"></div>
                <div class="menu" role="menu">
                  <span
                    class="menu-item"
                    onclick={() => {
                      menuFor = null;
                      form = { id: r.id, address: r.address, name: r.name, token: r.token ?? null };
                    }}
                    role="menuitem"
                    tabindex="0"><span class="menu-icon" style:mask={mask('edit')}></span>{t('ui.common.edit')}</span
                  >
                  <span class="menu-item" onclick={() => copyAddress(r)} role="menuitem" tabindex="0"><span class="menu-icon" style:mask={mask('copy')}></span>{t('ui.walletRecipients.copyAddress')}</span>
                  <span
                    class="menu-item danger"
                    onclick={() => {
                      menuFor = null;
                      confirmFor = r.id;
                    }}
                    role="menuitem"
                    tabindex="0"><span class="menu-icon" style:mask={mask('trash')}></span>{t('ui.common.remove')}</span
                  >
                </div>
              {/if}
            </div>
          {/each}
          {#if shown.length === 0}
            <div class="empty">
              <span class="empty-badge"><span class="empty-icon"></span></span>
              <span class="empty-title">{t(list.length ? 'ui.walletRecipients.noMatches' : 'ui.walletRecipients.noRecipients')}</span>
              <span class="empty-body">{list.length ? t('ui.walletRecipients.nothingMatches', { query: query.trim() }) : t('ui.walletRecipients.emptyBody')}</span>
            </div>
          {/if}
        </div>
      {:else}
        <div class="form">
          <div class="field">
            <span class="field-label">{t('ui.walletRecipients.addressLabel')}</span>
            <textarea
              class="address-input"
              class:valid
              class:invalid={!!addr && !valid}
              value={form.address}
              oninput={(e) => form && (form.address = e.currentTarget.value)}
              placeholder={t('ui.walletRecipients.addressPlaceholder')}
              rows="2"
            ></textarea>
            {#if addr}
              <div class="note" class:valid>
                <span class="note-icon" style:mask={mask(valid ? 'circle-check' : 'warning')}></span>
                <span class="note-text">{note}</span>
              </div>
            {/if}
          </div>
          <div class="field">
            <span class="field-label">{t('ui.walletRecipients.nameLabel')}</span>
            <input
              class="name-input"
              value={form.name}
              oninput={(e) => form && (form.name = e.currentTarget.value)}
              placeholder={valid ? t('ui.walletRecipients.defaultName', { network: NET_NAME[net as RecipientNetwork] }) : t('ui.walletRecipients.namePlaceholder')}
            />
            <span class="hint">{t('ui.walletRecipients.nameHint')}</span>
          </div>
          <div class="field">
            <span class="field-label">{t('ui.walletRecipients.restrictLabel')}</span>
            <div class="chips">
              {#each chips as c}
                {@const on = form.token === c.symbol}
                <span class="chip" class:on class:token={!!c.symbol} onclick={() => form && (form.token = c.symbol)} role="button" tabindex="0" aria-pressed={on}>
                  {#if c.symbol}<span class="chip-mark" style:background={c.grad}>{c.mark}</span>{/if}
                  <span class="chip-label">{t(c.label)}</span>
                </span>
              {/each}
            </div>
            <span class="hint wrap">{form.token ? t('ui.walletRecipients.onlyTokenHint', { token: form.token }) : t('ui.walletRecipients.anyTokenHint')}</span>
          </div>
          <div class="form-actions">
            <span class="form-cancel" onclick={back} role="button" tabindex="0">{t('ui.common.cancel')}</span>
            <span class="save" class:valid onclick={save} role="button" tabindex="0" aria-disabled={!valid}>{t(form.id ? 'ui.common.saveChanges' : 'ui.walletRecipients.saveRecipient')}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .recipients {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-32, 32px) var(--space-24);
  }

  .column {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .toolbar {
    display: flex;
    gap: var(--space-10);
  }

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 44px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .search-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-search) center/contain no-repeat;
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

  .add {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 44px;
    padding: 0 var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .add:hover {
    filter: brightness(1.08);
  }

  .add-icon {
    width: 14px;
    height: 14px;
    background: var(--on-accent, #2e0512);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .add-label {
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-height: 66px;
    padding: var(--space-12) var(--space-12) var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .initial {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font: var(--weight-bold) 15px/1 var(--font-sans);
    color: #0e0e12;
  }

  .row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .row-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .name {
    flex: 0 1 auto;
    min-width: 3em;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .net,
  .lock {
    flex: none;
    height: 18px;
    display: flex;
    align-items: center;
    padding: 0 6px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 10px/1 var(--font-mono);
  }

  .net {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    letter-spacing: 0.06em;
    color: var(--ink-2, #c9c9d4);
  }

  .lock {
    gap: 4px;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    color: var(--ink-3, #9a9aa8);
  }

  .lock-icon {
    width: 9px;
    height: 9px;
    background: currentColor;
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .row-meta {
    display: flex;
    align-items: baseline;
    gap: var(--space-6);
    min-width: 0;
    white-space: nowrap;
  }

  .address {
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .address.copied {
    color: var(--status-online, #2ee6a8);
  }

  .last {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1.2 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .send {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .send:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .send-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-send) center/contain no-repeat;
  }

  .options {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .options.open,
  .options:hover,
  .cancel:hover,
  .menu-item:hover,
  .form-cancel:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .options-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-more) center/contain no-repeat;
  }

  .confirm-label {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .cancel,
  .remove {
    flex: none;
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .cancel {
    color: var(--ink-2, #c9c9d4);
  }

  .remove {
    background: var(--status-danger, #f5493d);
    font-weight: var(--weight-bold);
    color: #fff;
  }

  .remove:hover {
    filter: brightness(1.08);
  }

  .menu-away {
    position: fixed;
    inset: 0;
    z-index: 4;
  }

  .menu {
    position: absolute;
    z-index: 5;
    inset-inline-end: 10px;
    top: calc(100% - 8px);
    width: 200px;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)),
      0 12px 30px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item {
    --item-ink: var(--ink, #ececf1);
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--item-ink);
    cursor: pointer;
  }

  .menu-item.danger {
    --item-ink: var(--status-danger, #f5493d);
  }

  .menu-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--item-ink);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-48, 48px) var(--space-24);
    text-align: center;
  }

  .empty-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .empty-icon {
    width: 20px;
    height: 20px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-users) center/contain no-repeat;
  }

  .empty-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .empty-body {
    max-width: 340px;
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-22, 22px);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .field-label {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .address-input,
  .name-input {
    width: 100%;
    box-sizing: border-box;
    border: 0;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    color: var(--ink, #ececf1);
  }

  .address-input {
    resize: none;
    padding: var(--space-12) var(--space-14);
    font: var(--weight-medium) var(--text-md) / 1.5 var(--font-mono);
    word-break: break-all;
  }

  .address-input.valid {
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .address-input.invalid {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .name-input {
    height: 44px;
    padding: 0 var(--space-14);
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
  }

  .note {
    --note-ink: var(--status-danger, #f5493d);
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--status-danger, #f5493d) 12%, transparent);
  }

  .note.valid {
    --note-ink: var(--status-online, #2ee6a8);
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 12%, transparent);
  }

  .note-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--note-ink);
  }

  .note-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--note-ink);
    text-wrap: pretty;
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .hint.wrap {
    line-height: 1.45;
    text-wrap: pretty;
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
    height: 32px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.03));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    cursor: pointer;
    user-select: none;
  }

  .chip.token {
    padding: 0 var(--space-12) 0 5px;
  }

  .chip.on {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .chip:hover {
    filter: brightness(1.15);
  }

  .chip-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font: var(--weight-bold) 9px/1 var(--font-sans);
    color: #0b0b0f;
  }

  .chip-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .chip.on .chip-label {
    color: var(--ink, #ececf1);
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-8);
    padding-block-start: var(--space-8);
  }

  .form-cancel,
  .save {
    display: flex;
    align-items: center;
    height: 44px;
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    cursor: pointer;
  }

  .form-cancel {
    padding: 0 var(--space-16);
    color: var(--ink-2, #c9c9d4);
  }

  .save {
    padding: 0 var(--space-20, 20px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font-weight: var(--weight-bold);
    color: var(--ink-4, #7c7c8c);
    cursor: default;
    user-select: none;
  }

  .save.valid {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
  }
</style>
