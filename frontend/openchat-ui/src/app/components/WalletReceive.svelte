<!-- Receive in the wallet main column: network picker (when a token travels on several), your address with copy and
     share-to-chat, a warning naming exactly what to send, your OpenChat handle, and a QR card. Below 760px the QR card
     moves above the form. Sharing posts the address to a chat (ChatPicker) and confirms with a toast. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import ChatPicker from '../../lib/components/ChatPicker.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';

  type NetworkId = 'icp' | 'eth' | 'btc' | 'xrpl';

  // sample receiving addresses until the wallet backend is wired
  const NET: Record<NetworkId, { label: string; short: string; time: string; blurb: string; address: string }> = {
    icp: { label: 'ICP network', short: 'Internet Computer', time: 'Seconds', blurb: 'Native on the Internet Computer. Arrives in seconds, fees in fractions of a cent.', address: '5sj6i-pqaaa-aaaaf-a3cmq-cai' },
    eth: { label: 'Ethereum network', short: 'As an ERC-20 token', time: '1–5 min', blurb: 'Arrives on Ethereum. Widely supported, slower and dearer when the network is busy.', address: '0x7Bf3c9A1e64D25aB8f0C3e7d19A4b62F5dE81Ca0' },
    btc: { label: 'Bitcoin network', short: 'Native BTC', time: '10–60 min', blurb: 'Settles on Bitcoin itself. Allow ten minutes or more per confirmation.', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    xrpl: { label: 'XRP Ledger', short: 'Native XRP', time: 'Seconds', blurb: 'Settles on the XRP Ledger within seconds.', address: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT' },
  };
  // wrapped forms on ICP get their chain-key name, so the warning names exactly what to send
  const ICP_AS: Record<string, string> = { BTC: 'ckBTC', ETH: 'ckETH', USDC: 'ckUSDC', USDT: 'ckUSDT', XRP: 'ckXRP' };
  // sample chats for share-to-chat until the chat list is wired
  const CHATS = [
    { name: 'Lucy Linden', kind: 'Direct chat', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', radius: '50%' },
    { name: 'The Awesome Group', kind: 'Group · 248 members', grad: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)', radius: '11px' },
    { name: 'Matt Rivers', kind: 'Direct chat', grad: 'linear-gradient(140deg,#ffb03d,#ff4d4d)', radius: '50%' },
    { name: '#general', kind: 'OpenChat community', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', radius: '11px' },
    { name: 'Design Guild', kind: 'Group · 112 members', grad: 'linear-gradient(140deg,#b06bff,#5b2a86)', radius: '11px' },
    { name: 'Ryan Rogers', kind: 'Direct chat', grad: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)', radius: '50%' },
  ];
  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;

  interface Props {
    /** Tokens with `nets` can be received; any listed token works, held or not. */
    tokens: WalletToken[];
    /** Symbol to receive; falls back to ICP, then the first receivable token. */
    token?: string;
    /** Your OpenChat handle; shows the "From OpenChat" row. */
    handle?: string;
    onShare?: (v: { chat: string; message: string; symbol: string; network: string; address: string }) => void;
    onClose?: () => void;
  }

  let { tokens, token, handle = '', onShare, onClose }: Props = $props();

  let width = $state(0);
  // a new token starts on its first network with the picker closed
  let netIdx = $derived.by(() => {
    void token;
    return 0;
  });
  let open = $derived.by(() => {
    void token;
    return false;
  });
  let copied = $derived.by(() => {
    void token;
    return false;
  });
  let handleCopied = $state(false);
  let sharing = $state(false);
  let toast = $state<{ id: number; message: string } | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let handleTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(copyTimer);
    clearTimeout(handleTimer);
    clearTimeout(toastTimer);
  });

  const narrow = $derived(width > 0 && width < 760);
  const receivable = $derived(tokens.filter((t) => t.nets?.length));
  const tok = $derived(receivable.find((x) => x.symbol === token) ?? receivable.find((x) => x.symbol === 'ICP') ?? receivable[0]);
  const ids = $derived((tok?.nets ?? []) as NetworkId[]);
  const id = $derived(ids[Math.min(netIdx, ids.length - 1)]);
  const wrapped = $derived(id === 'icp' && tok ? ICP_AS[tok.symbol] : undefined);
  const net = $derived(
    id
      ? {
          ...NET[id],
          ...(wrapped
            ? { label: 'ICP network', short: `Arrives as ${wrapped}`, blurb: `Arrives as ${wrapped} on the Internet Computer within seconds, for a fraction of a cent.` }
            : {}),
        }
      : null,
  );
  const address = $derived(id ? NET[id].address : '');

  function copy() {
    try {
      navigator.clipboard?.writeText(address);
    } catch {}
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1600);
  }

  function copyHandle() {
    handleCopied = true;
    clearTimeout(handleTimer);
    handleTimer = setTimeout(() => (handleCopied = false), 1600);
  }

  function share(v: { chat: string; message: string }) {
    if (!tok || !net) return;
    const tid = Date.now();
    sharing = false;
    toast = { id: tid, message: `Address shared to ${v.chat}` };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === tid) toast = null;
    }, 5000);
    onShare?.({ chat: v.chat, message: v.message, symbol: tok.symbol, network: net.label, address });
  }
</script>

<div class="receive" bind:clientWidth={width} data-screen-label="Wallet receive">
  {#if tok && net}
    <PageHeader title="Receive {tok.symbol}" onBack={() => onClose?.()} avatarMark={tok.mark} avatarGradient={tok.grad} />
    <div class="layout" class:narrow>
      <div class="form">
        <div class="group">
          <ListSectionLabel label="NETWORK" />
          {#if ids.length > 1}
            <div class="picker">
              <div class="select" class:open onclick={() => (open = !open)} tabindex="0" role="button" aria-expanded={open}>
                <span class="select-label">{net.label}</span>
                <span class="select-time">{net.time}</span>
                <span class="caret" class:open></span>
              </div>
              {#if open}
                <div class="away" onclick={() => (open = false)} role="presentation"></div>
                <div class="options">
                  {#each ids as nid, i}
                    {@const w = nid === 'icp' ? ICP_AS[tok.symbol] : undefined}
                    <div
                      class="option"
                      onclick={() => {
                        netIdx = i;
                        open = false;
                        copied = false;
                      }}
                      tabindex="0"
                      role="option"
                      aria-selected={i === netIdx}
                    >
                      <span class="option-text"><span class="option-label">{NET[nid].label}</span><span class="option-short">{w ? `Arrives as ${w}` : NET[nid].short}</span></span>
                      <span class="option-time">{NET[nid].time}</span>
                      <span class="tick" class:on={i === netIdx}></span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="single"><span class="select-label">{net.label}</span><span class="select-time">{net.time}</span></div>
          {/if}
        </div>
        <div class="group">
          <ListSectionLabel label="YOUR ADDRESS" />
          <div class="address-box">
            <div class="address-wrap">
              <span class="address">{address.slice(0, 6)}<span class="address-mid">{address.slice(6, -6)}</span>{address.slice(-6)}</span>
            </div>
            <div class="address-actions">
              <span class="square copy" class:copied onclick={copy} role="button" tabindex="0" title={copied ? 'Copied' : 'Copy address'} aria-label={copied ? 'Copied' : 'Copy address'}
                ><span class="square-icon" style:mask={mask(copied ? 'check' : 'copy')}></span></span
              >
              <span class="square" onclick={() => (sharing = true)} role="button" tabindex="0" title="Share to chat" aria-label="Share to chat"><span class="square-icon" style:mask={mask('share')}></span></span>
            </div>
          </div>
        </div>
        <div class="warning">
          <span class="warning-icon"></span><span class="warning-text"
            >Only send {wrapped || tok.symbol} on the {net.label} to this address. Sending other tokens, or {tok.symbol} on another network, can't be recovered.</span
          >
        </div>
        <span class="grow"></span>
        {#if handle}
          <div class="group">
            <ListSectionLabel label="FROM OPENCHAT" />
            <div class="handle-box">
              <span class="handle-avatar"></span>
              <div class="handle-text">
                <span class="handle"
                  >{handle}{#if handleCopied}<span class="handle-copied"><span class="handle-check"></span>Copied</span>{/if}</span
                >
                <span class="handle-note">Other OpenChat users can pay you from any chat. No address or network needed.</span>
              </div>
              <span class="square handle-copy" class:copied={handleCopied} onclick={copyHandle} role="button" tabindex="0" title="Copy username" aria-label="Copy username"
                ><span class="square-icon" style:mask={mask(handleCopied ? 'check' : 'copy')}></span></span
              >
            </div>
          </div>
        {/if}
      </div>
      <div class="qr-card">
        <span class="qr-kicker">SCAN TO PAY</span>
        <div class="qr"><span class="qr-code"><span class="qr-mark" style:background={tok.grad}>{tok.mark}</span></span></div>
        <span class="qr-title">{tok.symbol} on {net.label}</span>
        <span class="qr-blurb">{net.blurb}</span>
      </div>
    </div>
    {#if sharing}
      <ChatPicker
        title="Share to chat"
        previewLabel="SHARING YOUR ADDRESS"
        item={{ title: `My ${tok.symbol} address · ${net.label}`, sub: `${address.slice(0, 10)}…${address.slice(-8)}`, mark: tok.mark, grad: tok.grad }}
        chats={CHATS}
        onSend={share}
        onClose={() => (sharing = false)}
      />
    {/if}
    {#if toast}
      <div class="toast">
        <div class="toast-box">
          {#key toast.id}<UndoToast shown={true} tone="success" size="lg" icon="check" message={toast.message} onClose={() => (toast = null)} />{/key}
        </div>
      </div>
    {/if}
  {:else}
    <PageHeader title="Receive" onBack={() => onClose?.()} />
  {/if}
</div>

<style>
  .receive {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  .layout {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: stretch;
    align-content: start;
    gap: 28px;
    padding: 28px max(32px, calc((100% - 960px) / 2));
  }

  .layout.narrow {
    grid-template-columns: minmax(0, 1fr);
    padding: 24px 22px 28px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 32px;
    min-width: 0;
    order: 1;
  }

  .narrow .form {
    order: 2;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .picker {
    position: relative;
  }

  .select,
  .single {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .select {
    padding: 0 14px 0 16px;
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.08));
    cursor: pointer;
    user-select: none;
  }

  .select.open {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .select:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.06));
  }

  .single {
    padding: 0 16px;
  }

  .select-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .select-time {
    flex: none;
    font: var(--weight-medium) 12.5px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .caret {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .caret.open {
    transform: rotate(180deg);
  }

  .away {
    position: fixed;
    inset: 0;
    z-index: 4;
  }

  .options {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: var(--radius-md, 12px);
    background: var(--surface-2, #1b1b22);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)),
      0 18px 40px rgba(0, 0, 0, 0.5);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 12px;
    border-radius: 9px;
    cursor: pointer;
  }

  .option:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .option-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .option-label {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .option-short {
    font: var(--weight-regular) var(--text-xs) / 1.3 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .option-time {
    flex: none;
    font: var(--weight-semibold) 12.5px/1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .tick {
    flex: none;
    width: 16px;
    height: 16px;
    background: transparent;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .tick.on {
    background: var(--accent, #ff5672);
  }

  .address-box,
  .handle-box {
    display: flex;
    align-items: center;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .address-box {
    gap: 12px;
    padding: 14px 12px 14px 18px;
  }

  .address-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .address {
    font: var(--weight-medium) 16px/1.6 var(--font-mono);
    color: var(--ink, #ececf1);
    word-break: break-all;
  }

  .address-mid {
    color: var(--ink-3, #9a9aa8);
  }

  .address-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .square {
    --square-ink: var(--ink, #ececf1);
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    cursor: pointer;
  }

  .square.copy {
    --square-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
  }

  .square.copied {
    --square-ink: var(--status-online, #2ee6a8);
    background: rgba(46, 230, 168, 0.14);
  }

  .square:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.12));
  }

  .square-icon {
    width: 16px;
    height: 16px;
    background: var(--square-ink);
  }

  .warning {
    display: flex;
    gap: 12px;
    margin-top: -20px;
    padding: 14px 16px;
    border-radius: var(--radius-md, 12px);
    background: rgba(255, 176, 61, 0.08);
  }

  .warning-icon {
    flex: none;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    background: var(--status-gold, #ffb03d);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .warning-text {
    font: var(--weight-regular) 13px/1.5 var(--font-sans);
    color: var(--ink-2, #e8d6b8);
    text-wrap: pretty;
  }

  .grow {
    flex: 1;
  }

  .handle-box {
    gap: 14px;
    padding: 14px 12px 14px 16px;
  }

  .handle-avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-pill);
    background: linear-gradient(140deg, #b06bff, #5b2a86);
  }

  .handle-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .handle {
    display: flex;
    align-items: center;
    gap: 8px;
    font: var(--weight-semibold) 15px/1.2 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .handle-copied {
    display: flex;
    align-items: center;
    gap: 5px;
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--status-online, #2ee6a8);
  }

  .handle-check {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .handle-note {
    font: var(--weight-regular) 12.5px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .qr-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    order: 2;
  }

  .narrow .qr-card {
    order: 1;
  }

  .qr-kicker {
    align-self: flex-start;
    font: var(--weight-semibold) 11.5px/1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #8a8a99);
  }

  .qr {
    width: 240px;
    height: 240px;
    margin-top: 10px;
    border-radius: 18px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* placeholder pattern until real QR codes are generated */
  .qr-code {
    width: 204px;
    height: 204px;
    border-radius: 8px;
    background:
      repeating-linear-gradient(0deg, #0b0b10 0 9px, transparent 9px 18px),
      repeating-linear-gradient(90deg, #0b0b10 0 9px, transparent 9px 18px);
    opacity: 0.85;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-mark {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 6px #fff;
    font: 700 20px/1 var(--font-sans);
    color: #0b0b10;
  }

  .qr-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-align: center;
  }

  .qr-blurb {
    font: var(--weight-regular) 12.5px/1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-align: center;
    text-wrap: pretty;
  }

  .toast {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    z-index: 30;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .toast-box {
    pointer-events: auto;
    width: min(480px, calc(100% - 48px));
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
