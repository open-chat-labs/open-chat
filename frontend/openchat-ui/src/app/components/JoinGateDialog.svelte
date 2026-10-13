<!-- Join dialog for a gated community. Gates are a checklist; "all" shows progress, "any" turns rows into choices.
     Free checks (balance, neuron, Diamond) are resolved first; payments are charged together on "Pay and join".
     Diamond is bought in the Diamond dialog (onGetDiamond) and never appears in this payment summary.
     Balances come from the host (tokens / chatBalance): pass fresh values to re-check, e.g. when the tab regains focus. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../../lib/components/Button.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  const ADDRESS = 'wq4pz-ixa3f-ubm7c-2jtw4-7d41e-cai';
  const fmt = (n: number, dp?: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: dp ?? 4 });

  type GateState = 'met' | 'pay' | 'todo' | 'short';

  export interface Gate {
    kind: 'pay' | 'balance' | 'neuron' | 'diamond';
    /** pay / balance: token and amount. */
    symbol?: string;
    amount?: number;
    /** neuron: title, detail and the confirmation wording. */
    label?: string;
    detail?: string;
    confirm?: string;
  }

  interface Props {
    community: { name: string; members?: number; grad?: string };
    /** all = every gate required; any = one of them is enough. */
    rule?: 'all' | 'any';
    gates: Gate[];
    tokens?: { symbol: string; held: number; mark: string; grad: string }[];
    /** Overrides the CHAT entry in tokens. */
    chatBalance?: number;
    isDiamond?: boolean;
    isLifetime?: boolean;
    recheckDays?: number;
    /** Share of payments that goes to the community owner (the rest to the treasury). */
    ownerShare?: number;
    z?: number;
    onGetDiamond?: () => void;
    onJoin?: (r: { paid: { symbol: string; amount: number }[] }) => void;
    onClose?: () => void;
  }

  let {
    community,
    rule = 'all',
    gates,
    tokens = [],
    chatBalance,
    isDiamond = false,
    isLifetime = false,
    recheckDays,
    ownerShare = 0.98,
    z = 70,
    onGetDiamond,
    onJoin,
    onClose,
  }: Props = $props();

  let confirmed = $state(false);
  let picked = $state<number | null>(null);
  let busy = $state(false);
  let copied = $state(false);
  let checking = $state(false);
  let joinTimer: ReturnType<typeof setTimeout> | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => [joinTimer, copyTimer, checkTimer].forEach(clearTimeout));

  const any = $derived(rule === 'any');

  function held(sym: string) {
    if (sym === 'CHAT' && chatBalance != null) return chatBalance;
    return tokens.find((x) => x.symbol === sym)?.held ?? 0;
  }

  const token = (sym: string) => tokens.find((x) => x.symbol === sym) ?? { symbol: sym, mark: sym[0], grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' };

  const rows = $derived(
    gates.map((g) => {
      if (g.kind === 'pay' || g.kind === 'balance') {
        const sym = g.symbol ?? '', amount = g.amount ?? 0, have = held(sym), tk = token(sym), ok = have >= amount;
        const pay = g.kind === 'pay';
        return {
          gate: g,
          token: tk,
          icon: null,
          title: `${pay ? 'Pay' : 'Hold'} ${fmt(amount)} ${sym}`,
          detail: `You have ${fmt(have, 2)} ${sym}`,
          state: (ok ? (pay ? 'pay' : 'met') : 'short') as GateState,
          short: ok ? 0 : amount - have,
          free: !pay,
        };
      }
      if (g.kind === 'neuron')
        return {
          gate: g,
          token: null,
          icon: 'neuron',
          title: g.label || 'Neuron holder',
          detail: confirmed ? 'Confirmed by you' : (g.detail ?? ''),
          state: (confirmed ? 'met' : 'todo') as GateState,
          short: 0,
          free: true,
        };
      return {
        gate: g,
        token: null,
        icon: 'diamond',
        title: 'Lifetime Diamond member',
        detail: isLifetime ? "You're a lifetime member" : isDiamond ? 'You have Diamond, but not lifetime' : "You're not a member yet",
        state: (isLifetime ? 'met' : 'todo') as GateState,
        short: 0,
        free: true,
      };
    }),
  );

  const ready = (r: { state: GateState }) => r.state === 'met' || r.state === 'pay';
  const freeMet = $derived(rows.findIndex((r) => r.free && r.state === 'met'));
  // "any": default to a free way in you already meet, else the first ready one
  const selected = $derived.by(() => {
    if (!any) return -1;
    if (picked != null) return picked;
    const i = freeMet >= 0 ? freeMet : rows.findIndex(ready);
    return i < 0 ? 0 : i;
  });
  const chosen = $derived(any ? [rows[selected]].filter(Boolean) : rows);
  const pays = $derived(chosen.filter((r) => r.gate.kind === 'pay' && r.state === 'pay'));
  const nReady = $derived(rows.filter(ready).length);
  const canJoin = $derived(chosen.length > 0 && chosen.every(ready));
  const enabled = $derived(canJoin && !busy);
  const selGate = $derived(any ? rows[selected] : null);

  const reason = $derived.by(() => {
    if (canJoin) {
      if (!any) return `All ${rows.length} requirements ready`;
      return selGate?.free ? `Free with ${selGate.gate.kind === 'diamond' ? 'your Diamond membership' : 'this requirement'}` : 'Paying is your way in';
    }
    if (any) return selGate?.state === 'short' ? `Not enough ${selGate.gate.symbol} for this way in` : 'Finish this requirement to join';
    const left = rows.length - nReady;
    return `${left} ${left === 1 ? 'requirement' : 'requirements'} left`;
  });

  const split = $derived(
    pays.length
      ? [
          { label: `Community owner · ${Math.round(ownerShare * 100)}%`, value: pays.map((r) => `${fmt((r.gate.amount ?? 0) * ownerShare)} ${r.gate.symbol}`).join(' · ') },
          { label: `OpenChat treasury · ${Math.round((1 - ownerShare) * 100)}%`, value: pays.map((r) => `${fmt((r.gate.amount ?? 0) * (1 - ownerShare))} ${r.gate.symbol}`).join(' · ') },
        ]
      : [],
  );

  function copy(e?: Event) {
    e?.stopPropagation();
    try {
      navigator.clipboard?.writeText(ADDRESS);
    } catch {}
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1600);
  }

  function recheck(e: Event) {
    e.stopPropagation();
    checking = true;
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => (checking = false), 700);
  }

  function join() {
    if (!enabled) return;
    busy = true;
    const paid = pays.map((r) => ({ symbol: r.gate.symbol ?? '', amount: r.gate.amount ?? 0 }));
    joinTimer = setTimeout(() => onJoin?.({ paid }), 1300);
  }

  function close() {
    if (!busy) onClose?.();
  }
</script>

<DialogShell title="Join community" width={520} height="auto" flush={true} {z} onClose={close}>
  <div class="content">
    <div class="intro">
      <div class="community">
        <span class="avatar" style:background={community.grad || 'var(--overlay-2)'}></span>
        <div class="names">
          <span class="name">{community.name}</span>
          <span class="meta">Community · {community.members != null ? `${Number(community.members).toLocaleString('en-US')} members` : ''}</span>
        </div>
        <span class="rule" class:any>{any ? `Any one of ${rows.length}` : `All ${rows.length} required`}</span>
      </div>
      <span class="lead">{any ? 'Meet any one of these to join. Pick the one that suits you.' : `Meet every requirement to join.${recheckDays ? ` Re-checked every ${recheckDays} days.` : ''}`}</span>
      {#if !any}
        <div class="progress">
          <span class="segments">{#each rows as _, i}<span class="segment" class:done={i < nReady}></span>{/each}</span>
          <span class="progress-label">{nReady} of {rows.length} ready</span>
        </div>
      {/if}
    </div>
    <div class="list" role={any ? 'radiogroup' : 'list'} aria-label="Requirements">
      {#each rows as r, i}
        {@const isSel = any && i === selected}
        {@const skipped = any && !isSel && freeMet >= 0 && r.gate.kind === 'pay'}
        {@const active = !any || isSel}
        {@const chip = skipped ? 'skip' : r.state}
        <div
          class="gate"
          class:any
          class:selected={isSel}
          class:skipped
          role={any ? 'radio' : 'listitem'}
          aria-checked={any ? isSel : undefined}
          tabindex={any ? 0 : undefined}
          onclick={any ? () => !busy && (picked = i) : undefined}
        >
          <div class="gate-row">
            {#if any}<span class="radio" aria-hidden="true"><span class="radio-dot"></span></span>{/if}
            {#if r.token}<TokenAvatar symbol={r.token.symbol} mark={r.token.mark} gradient={r.token.grad} size={40} />{/if}
            {#if r.icon}<span class="gate-icon"><span class="gate-glyph {r.icon}"></span></span>{/if}
            <span class="gate-text">
              <span class="gate-title">{r.title}</span>
              <span class="gate-detail" class:short={r.state === 'short'}>{skipped ? 'Not needed, you already qualify' : r.detail}</span>
            </span>
            <span class="chip {chip}"
              >{#if chip === 'met' || chip === 'pay'}<span class="chip-icon"></span>{/if}{chip === 'met'
                ? 'Met'
                : chip === 'pay'
                  ? 'Paid on join'
                  : chip === 'todo'
                    ? 'Needs you'
                    : chip === 'skip'
                      ? 'Not needed'
                      : `${fmt(r.short, 2)} short`}</span
            >
          </div>
          {#if active && r.state === 'short'}
            <div class="extra">
              <span class="extra-text"
                >{r.gate.kind === 'pay'
                  ? `Add ${fmt(r.short, 2)} ${r.gate.symbol} to this wallet to cover the fee.`
                  : `Top up ${fmt(r.short, 2)} ${r.gate.symbol} to this wallet. Nothing is charged; we only check the balance.`}</span
              >
              <div class="address">
                <span class="address-text">{ADDRESS}</span>
                <IconButton variant="ghost" icon={copied ? 'check' : 'copy'} label={copied ? 'Copied' : 'Copy wallet address'} onClick={copy} />
              </div>
              <div class="recheck-row">
                <span class="recheck" onclick={recheck} role="button" tabindex="0"><span class="recheck-icon" class:spinning={checking}></span>{checking ? 'Checking…' : 'Check again'}</span>
                <span class="recheck-hint">Also re-checked when you come back to this tab</span>
              </div>
            </div>
          {/if}
          {#if active && r.gate.kind === 'neuron' && r.state === 'todo'}
            <div class="extra">
              <div class="confirm">
                <Toggle on={confirmed} label="" onChange={(v) => (confirmed = v)} />
                <span class="confirm-text">{r.gate.confirm || 'I hold a qualifying neuron.'}</span>
              </div>
              <span class="small">Checked when you join. If it isn't true, joining fails and nothing is charged.</span>
            </div>
          {/if}
          {#if active && r.gate.kind === 'diamond' && r.state === 'todo'}
            <div class="extra diamond">
              <span class="diamond-text">60 CHAT, once. Unlocks every Diamond perk, not just this community.</span>
              <Button label="Get Lifetime Diamond" variant="secondary" onClick={() => onGetDiamond?.()} />
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="footer">
      {#if pays.length}
        <div class="charges">
          <div class="charge-total">
            <span class="charge-label">Charged when you join</span><span class="charge-amount">{pays.map((r) => `${fmt(r.gate.amount ?? 0)} ${r.gate.symbol}`).join(' + ')}</span>
          </div>
          {#each split as part}<div class="charge-split"><span class="split-label">{part.label}</span><span class="split-value">{part.value}</span></div>{/each}
        </div>
      {/if}
      <div class="action-row">
        <span class="reason" class:ready={canJoin} class:free={canJoin && any && !!selGate?.free} aria-live="polite">{reason}</span>
        <span class="cta" class:ready={canJoin} class:enabled class:busy onclick={join} role="button" tabindex={enabled ? 0 : -1} aria-disabled={!canJoin} aria-busy={busy}>
          {#if busy}
            <Spinner size={16} tone="ink" label="Joining" />
          {:else}
            <span>{pays.length ? 'Pay and join' : 'Join community'}</span>
          {/if}
        </span>
      </div>
    </div>
  </div>
</DialogShell>

<style>
  .content {
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-18) var(--space-22, 22px) var(--space-12);
  }

  .community {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .name {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .meta {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .rule {
    flex: none;
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
  }

  .rule.any {
    background: color-mix(in oklch, var(--status-verified, #3d9bff) 15%, transparent);
    color: var(--status-verified, #3d9bff);
  }

  .lead {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-10);
  }

  .segments {
    flex: 1;
    display: flex;
    gap: 4px;
  }

  .segment {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    transition: background var(--duration-base, 0.2s);
  }

  .segment.done {
    background: var(--status-online, #2ee6a8);
  }

  .progress-label {
    flex: none;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-4) var(--space-14) var(--space-16);
  }

  .gate {
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: var(--surface-2, #191921);
    box-shadow: none;
    opacity: 1;
    cursor: default;
    outline: none;
    transition:
      box-shadow var(--duration-fast, 0.12s),
      opacity var(--duration-base, 0.2s);
  }

  .gate.any {
    cursor: pointer;
  }

  .gate.selected {
    box-shadow: inset 0 0 0 1.5px var(--accent, #ff5672);
  }

  .gate.skipped {
    opacity: 0.6;
  }

  .gate:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .gate-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 64px;
    box-sizing: border-box;
    padding: var(--space-10) var(--space-14) var(--space-10) var(--space-12);
  }

  .radio {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    box-sizing: border-box;
    box-shadow: inset 0 0 0 1.5px var(--line-3, rgba(255, 255, 255, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .selected .radio {
    box-shadow: inset 0 0 0 2px var(--accent, #ff5672);
  }

  .radio-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
  }

  .selected .radio-dot {
    background: var(--accent, #ff5672);
  }

  .gate-icon {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .gate-glyph {
    width: 19px;
    height: 19px;
  }

  .gate-glyph.neuron {
    background: var(--accent-bright, #ff8298);
    mask: var(--icon-neuron) center/contain no-repeat;
  }

  .gate-glyph.diamond {
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-diamond) center/contain no-repeat;
  }

  .gate-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .gate-title {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .gate-detail {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .gate-detail.short {
    color: var(--status-warning, #ffb03d);
  }

  .chip {
    flex: none;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: var(--radius-pill);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
  }

  .chip.met {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 14%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .chip.pay {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink-2, #c9c9d4);
  }

  .chip.todo,
  .chip.short {
    background: color-mix(in oklch, var(--status-warning, #ffb03d) 14%, transparent);
    color: var(--status-warning, #ffb03d);
  }

  .chip.skip {
    background: transparent;
    color: var(--ink-4, #8a8a99);
  }

  .chip-icon {
    display: block;
    width: 12px;
    height: 12px;
    background: currentColor;
  }

  .met .chip-icon {
    mask: var(--icon-check) center/contain no-repeat;
  }

  .pay .chip-icon {
    mask: var(--icon-wallet) center/contain no-repeat;
  }

  .extra {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: 0 var(--space-14) var(--space-14) 64px;
  }

  .extra-text,
  .diamond-text {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .address {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 40px;
    padding: 0 6px 0 12px;
    border-radius: 10px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .address-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recheck-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex-wrap: wrap;
  }

  .recheck {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
    cursor: pointer;
    user-select: none;
  }

  .recheck-icon {
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--icon-refresh) center/contain no-repeat;
    transition: transform 0.6s;
  }

  .recheck-icon.spinning {
    transform: rotate(-360deg);
  }

  .recheck-hint {
    font: var(--weight-regular) var(--text-xs) / 1.3 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .confirm {
    display: flex;
    gap: var(--space-10);
    align-items: flex-start;
    padding: var(--space-12);
    border-radius: 10px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .confirm-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .small {
    font: var(--weight-regular) var(--text-xs) / 1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .extra.diamond {
    flex-direction: row;
    align-items: center;
    gap: var(--space-12);
    flex-wrap: wrap;
  }

  .diamond-text {
    flex: 1 1 180px;
    min-width: 0;
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-22, 22px) var(--space-22, 22px);
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .charges {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .charge-total {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
  }

  .charge-label {
    flex: 1;
    font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .charge-amount {
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .charge-split {
    display: flex;
    gap: var(--space-10);
  }

  .split-label {
    flex: 1;
    font: var(--weight-regular) var(--text-xs) / 1.3 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .split-value {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .reason {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-warning, #ffb03d);
    text-wrap: pretty;
  }

  .reason.ready {
    color: var(--ink-3, #9a9aa8);
  }

  .reason.free {
    color: var(--status-online, #2ee6a8);
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    min-width: 148px;
    height: 40px;
    box-sizing: border-box;
    padding: 0 var(--space-18);
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    cursor: not-allowed;
    user-select: none;
    transition: background var(--duration-fast, 0.12s);
  }

  .cta.ready {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .cta.busy {
    cursor: progress;
  }

  .cta.enabled {
    cursor: pointer;
  }

  .cta.enabled:hover {
    filter: brightness(1.08);
  }

  .cta:focus-visible {
    box-shadow: var(--focus-ring);
  }
</style>
