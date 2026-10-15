<!-- Receive in the wallet main column, one column: network picker (when a token travels on several), then an address
     card with the QR code, the address, Copy and Share to chat; a warning naming exactly what to send, and your OpenChat
     handle. The QR is drawn by the host (`qr` snippet); without it the card has no QR. Hovering the card (always, on touch)
     shows a button that copies the QR as an image; right-clicking the QR does the same where the browser can. Sharing posts
     the address to one of the host's `chats` (ChatPicker) through onShare and confirms with a toast once the host does. -->
<script lang="ts" module>
  export type NetworkId = 'icp' | 'eth' | 'btc' | 'xrpl';

  export interface ShareChat {
    id: string;
    name: string;
    /** "Direct chat", "Group · 248 members" … */
    kind?: string;
    /** Avatar background. */
    grad?: string;
    /** 50% for people, 11px for groups. */
    radius?: string;
  }
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import CopyButton from '../../lib/components/CopyButton.svelte';
  import { onDestroy, type Snippet } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { canCopyImage, copyImage } from '../../lib/clipboard';
  import type { WalletToken } from '../../lib/types';
  import ChatPicker from '../../lib/components/ChatPicker.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';

  // label / short / time are resource keys; the addresses themselves always come from the host
  const NET: Record<NetworkId, { label: string; short: string; time: string }> = {
    icp: { label: 'ui.walletReceive.net.icp.label', short: 'ui.walletReceive.net.icp.short', time: 'ui.walletReceive.net.icp.time' },
    eth: { label: 'ui.walletReceive.net.eth.label', short: 'ui.walletReceive.net.eth.short', time: 'ui.walletReceive.net.eth.time' },
    btc: { label: 'ui.walletReceive.net.btc.label', short: 'ui.walletReceive.net.btc.short', time: 'ui.walletReceive.net.btc.time' },
    xrpl: { label: 'ui.walletReceive.net.xrpl.label', short: 'ui.walletReceive.net.xrpl.short', time: 'ui.walletReceive.net.xrpl.time' },
  };
  // wrapped forms on ICP get their chain-key name, so the warning names exactly what to send
  const ICP_AS: Record<string, string> = { BTC: 'ckBTC', ETH: 'ckETH', USDC: 'ckUSDC', USDT: 'ckUSDT', XRP: 'ckXRP' };
  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;

  interface Props {
    /** Tokens with `nets` can be received; any listed token works, held or not. */
    tokens: WalletToken[];
    /** Symbol to receive; falls back to ICP, then the first receivable token. */
    token?: string;
    /** Your OpenChat handle; shows the "From OpenChat" row. */
    handle?: string;
    /** The user's own receiving address per network. A network without one shows no address, copy, share or QR. */
    addresses?: Partial<Record<NetworkId, string>>;
    /** Chats the address can be shared to. Share is hidden without chats or onShare. */
    chats?: ShareChat[];
    /** Post the address to a chat. Reject to keep the picker open with an error. */
    onShare?: (v: { chatId: string; message: string; symbol: string; network: NetworkId; address: string }) => Promise<unknown> | void;
    /** Draws a scannable QR code for the address as an svg, canvas or img, scaled to fill a white square of about 135px
     *  (that element is what "Copy QR image" copies). Without it the address card has no QR. */
    qr?: Snippet<[string]>;
    onClose?: () => void;
  }

  let { tokens, token, handle = '', addresses = {}, chats = [], onShare, qr, onClose }: Props = $props();
  const t = useT();

  let width = $state(0);
  // WalletMain remounts Receive for each token, so the network and picker start fresh there
  let netIdx = $state(0);
  let open = $state(false);
  let handleCopied = $state(false);
  let sharing = $state(false);
  let toast = $state<{ id: number; message: string; tone: 'success' | 'danger' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(toastTimer));

  const narrow = $derived(width > 0 && width < 760);
  const receivable = $derived(tokens.filter((t) => t.nets?.length));
  const tok = $derived(receivable.find((x) => x.symbol === token) ?? receivable.find((x) => x.symbol === 'ICP') ?? receivable[0]);
  const ids = $derived((tok?.nets ?? []) as NetworkId[]);
  const id = $derived(ids[Math.min(netIdx, ids.length - 1)]);
  const wrapped = $derived(id === 'icp' && tok ? ICP_AS[tok.symbol] : undefined);
  const net = $derived(id ? { ...NET[id], ...(wrapped ? { short: t('ui.walletReceive.arrivesAs', { token: wrapped }) } : {}) } : null);
  const address = $derived((id && addresses[id]) || '');


  // the QR as an image: offered only where the browser can put an image on the clipboard
  const imageCopy = canCopyImage();
  let qrBox = $state<HTMLElement>();
  let copyingQr = false;
  async function copyQr() {
    if (!qrBox || copyingQr) return;
    copyingQr = true;
    const ok = await copyImage(qrBox);
    copyingQr = false;
    notify(t(ok ? 'ui.walletReceive.qrCopied' : 'ui.walletReceive.qrCopyFailed'), ok ? 'success' : 'danger');
  }
  // right-click copies too, but only where it can: elsewhere the browser's own menu stays
  function qrMenu(e: MouseEvent) {
    if (!imageCopy) return;
    e.preventDefault();
    copyQr();
  }

  // the share's host call: one at a time, and the picker stays until it settles
  const shareFlow = new DialogFlow();
  const canShare = $derived(!!onShare && chats.length > 0);

  function notify(message: string, tone: 'success' | 'danger') {
    const tid = Date.now();
    toast = { id: tid, message, tone };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === tid) toast = null;
    }, 5000);
  }

  // the picker stays open until the host has posted it
  async function share(v: { chatId: string; chat: string; message: string }) {
    if (!tok || !net || !address || !id || !onShare || shareFlow.busy) return;
    const target = chats.find((c) => c.id === v.chatId);
    if (!target) return;
    const post = onShare;
    const symbol = tok.symbol, network = id;
    const result = await shareFlow.run(() => post({ chatId: target.id, message: v.message, symbol, network, address }));
    if (result.ok) {
      sharing = false;
      notify(t('ui.walletReceive.shared', { chat: target.name }), 'success');
    } else if (shareFlow.failed) notify(t('ui.walletReceive.shareFailed', { chat: target.name }), 'danger');
  }
</script>

<div class="receive" bind:clientWidth={width} data-screen-label="Wallet receive">
  {#if tok && net}
    <PageHeader title={t('ui.walletReceive.receiveToken', { symbol: tok.symbol })} onBack={() => onClose?.()} avatarMark={tok.mark} avatarGradient={tok.grad} />
    <div class="scroll">
      <div class="column" class:narrow>
        <div class="group">
          <ListSectionLabel label={t('ui.walletReceive.network')} />
          {#if ids.length > 1}
            <div class="picker">
              <div class="select" class:open onclick={() => (open = !open)} tabindex="0" role="button" aria-expanded={open}>
                <span class="select-label">{t(net.label)}</span>
                <span class="select-time">{t(net.time)}</span>
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
                      }}
                      tabindex="0"
                      role="option"
                      aria-selected={i === netIdx}
                    >
                      <span class="option-text"><span class="option-label">{t(NET[nid].label)}</span><span class="option-short">{w ? t('ui.walletReceive.arrivesAs', { token: w }) : t(NET[nid].short)}</span></span>
                      <span class="option-time">{t(NET[nid].time)}</span>
                      <span class="tick" class:on={i === netIdx}></span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="single"><span class="select-label">{t(net.label)}</span><span class="select-time">{t(net.time)}</span></div>
          {/if}
        </div>
        <div class="group">
          <ListSectionLabel label={t('ui.walletReceive.yourAddress')} />
          <div class="address-card">
            {#if !address}
              <span class="address-missing">{t('ui.walletReceive.noAddress')}</span>
            {:else}
              {#if qr}
                <div class="qr-box" oncontextmenu={qrMenu} role="presentation">
                  <div class="qr" bind:this={qrBox}>{@render qr(address)}</div>
                  {#if imageCopy}<span class="qr-copy" onclick={copyQr} role="button" tabindex="0" title={t('ui.walletReceive.copyQr')} aria-label={t('ui.walletReceive.copyQr')}
                      ><span class="qr-copy-icon"></span></span
                    >{/if}
                </div>
              {/if}
              <div class="address-side">
                <span class="address">{address.slice(0, 6)}<span class="address-mid">{address.slice(6, -6)}</span>{address.slice(-6)}</span>
                <div class="actions">
                  <!-- keyed: "Copied" never shows for an address no longer on screen -->
                  {#key address}<CopyButton value={address} variant="primary" label="ui.walletReceive.copyAddress" />{/key}
                  {#if canShare}<span class="pill share-address" onclick={() => (sharing = true)} role="button" tabindex="0"
                      ><span class="pill-icon" style:mask={mask('share')}></span>{t('ui.walletReceive.shareToChat')}</span
                    >{/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
        <div class="warning">
          <span class="warning-icon"></span><span class="warning-text"
            >{t('ui.walletReceive.warning', { token: wrapped || tok.symbol, network: t(net.label), symbol: tok.symbol })}</span
          >
        </div>
        {#if handle}
          <div class="group">
            <ListSectionLabel label={t('ui.walletReceive.fromOpenChat')} />
            <div class="handle-box">
              <span class="handle-avatar"></span>
              <div class="handle-text">
                <span class="handle"
                  >{handle}{#if handleCopied}<span class="handle-copied"><span class="handle-check"></span>{t('ui.common.copied')}</span>{/if}</span
                >
                <span class="handle-note">{t('ui.walletReceive.handleNote')}</span>
              </div>
              <CopyButton value={handle} label="ui.walletReceive.copyUsername" variant="soft" size="lg" bind:copied={handleCopied} />
            </div>
          </div>
        {/if}
      </div>
    </div>
    {#if sharing && address && canShare}
      <ChatPicker
        title={t('ui.walletReceive.shareToChat')}
        previewLabel={t('ui.walletReceive.sharingAddress')}
        item={{ title: t('ui.walletReceive.shareItemTitle', { symbol: tok.symbol, network: t(net.label) }), sub: `${address.slice(0, 10)}…${address.slice(-8)}`, mark: tok.mark, grad: tok.grad }}
        chats={chats.map((c) => ({ id: c.id, name: c.name, kind: c.kind, grad: c.grad ?? 'var(--overlay-2)', radius: c.radius }))}
        sendLabel={shareFlow.busy ? 'ui.walletReceive.sharingNow' : 'ui.common.send'}
        onSend={share}
        onClose={() => {
          if (!shareFlow.busy) sharing = false;
        }}
      />
    {/if}
    {#if toast}
      <!-- above the chat picker while it's open, so a failed share is visible where the user is looking -->
      <div class="toast" class:over-picker={sharing}>
        <div class="toast-box">
          {#key toast.id}<UndoToast shown={true} tone={toast.tone === 'success' ? 'success' : 'neutral'} size="lg" icon={toast.tone === 'success' ? 'check' : 'none'} message={toast.message} onClose={() => (toast = null)} />{/key}
        </div>
      </div>
    {/if}
  {:else}
    <PageHeader title={t('ui.walletReceive.receive')} onBack={() => onClose?.()} />
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

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .column {
    box-sizing: content-box;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 28px 32px;
  }

  .column.narrow {
    padding: 24px 22px 28px;
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

  .handle-box {
    display: flex;
    align-items: center;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .address-card {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 20px;
    padding: 18px;
    border-radius: 16px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .qr-box {
    position: relative;
    flex: none;
    width: min(156px, 100%);
    aspect-ratio: 1;
    border-radius: 14px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .narrow .qr-box {
    width: min(168px, 100%);
  }

  .qr {
    width: 86%;
    height: 86%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .qr > :global(svg),
  .qr > :global(canvas),
  .qr > :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* shown on hover of the card (always on touch screens) and when focused */
  .qr-copy {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(14, 14, 18, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .address-card:hover .qr-copy,
  .qr-copy:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    .qr-copy {
      opacity: 1;
    }
  }

  .qr-copy:hover {
    background: rgba(14, 14, 18, 0.95);
  }

  .qr-copy-icon {
    width: 14px;
    height: 14px;
    background: #fff;
    mask: var(--icon-image) center/contain no-repeat;
  }

  .address-side {
    flex: 1 1 240px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    font: 600 13px/1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .pill-icon {
    width: 14px;
    height: 14px;
    background: currentColor;
  }

  .share-address {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink, #ececf1);
  }

  .share-address:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.12));
  }

  .address-missing {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .address {
    font: var(--weight-medium) 15px/1.6 var(--font-mono);
    color: var(--ink, #ececf1);
    word-break: break-all;
  }

  .address-mid {
    color: var(--ink-3, #9a9aa8);
  }

  .warning {
    display: flex;
    gap: 12px;
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

  .toast.over-picker {
    z-index: 100;
  }

  .toast-box {
    pointer-events: auto;
    width: min(480px, calc(100% - 48px));
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
