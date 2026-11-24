<!-- Receive (native design notes §3.9 Flows; the plan's 13): the token (its sheet, the whole
     catalogue, opening by itself when Receive starts from the wallet), then the QR card with the
     address (its middle dimmed) and the network chip, the warning naming exactly what to send, the
     @username card, and Copy / Share pinned at the bottom. The networks, the address on each and
     what depositing costs are ReceiveAccount's and walletFlows' receiveNetworks (the web's
     Receive's); a token on several networks (BTC or ckBTC, SOL or ckSOL, oneSec's chains) has a
     chip that opens them in an anchored menu. Its balance is refreshed every 10 s while it's open,
     as on the web. Share is the system share sheet (copied where there's none). -->
<script lang="ts">
    import {
        allUsersStore,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        type OpenChat,
    } from "@client";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import QRCode from "@src/core/QRCode.svelte";
    import { swatchFor } from "@src/logic/swatch";
    import { ReceiveAccount, type ReceiveToken } from "@src/logic/wallet/receiveAccount.svelte";
    import { receiveNetworks } from "@src/logic/wallet/walletFlows";
    import { shareText } from "@src/utils/share";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import { addressParts, tokenFace } from "./flows.adapter";
    import SupportedTokensSheet from "./SupportedTokensSheet.svelte";
    import type { WalletFigures } from "./wallet.adapter";
    import FlowPicker from "./FlowPicker.svelte";

    type Props = { ledger: string | undefined; context: ScreenContext; figures: WalletFigures };

    let { ledger, context, figures }: Props = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    // ---- the token: the one it opened on, else asked for as it opens

    let chosen = $state(untrack(() => ledger));
    let picking = $state(false);
    useOverlay(
        overlays,
        () => picking,
        () => (picking = false),
    );
    let asking: ReturnType<typeof setTimeout> | undefined;
    onMount(() => {
        // once the push has landed (the prototype's 380ms)
        if (chosen === undefined) asking = setTimeout(() => (picking = true), 380);
    });
    onDestroy(() => clearTimeout(asking));

    const face = $derived(tokenFace(figures, chosen));
    const details = $derived(chosen === undefined ? undefined : $cryptoLookup.get(chosen));

    // ---- where it's received

    const NO_TOKEN: ReceiveToken = {
        ledger: "",
        symbol: "",
        decimals: 8,
        oneSecEnabled: false,
        evmContractAddresses: [],
    };
    const account = new ReceiveAccount(
        client,
        () => details ?? NO_TOKEN,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );
    const networks = $derived(
        details === undefined
            ? []
            : receiveNetworks(account, details.symbol, (key, values) => $_(key, { values })),
    );
    const network = $derived(
        networks.find((n) => n.id === account.selectedNetwork) ?? networks[0],
    );
    const address = $derived(network?.address);
    const parts = $derived(address === undefined ? undefined : addressParts(address));

    // deposits arrive while it's open
    $effect(() => {
        const id = chosen;
        if (id === undefined) return;
        const timer = setInterval(() => client.refreshAccountBalance(id, false), 10_000);
        return () => clearInterval(timer);
    });

    // ---- the network chip's menu

    let networkAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => networkAnchor !== null,
        () => (networkAnchor = null),
    );

    // ---- Copy and Share

    let copied = $state(false);
    let copiedTimer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(copiedTimer));

    async function copy() {
        if (address === undefined || !(await copyText(address))) return;
        copied = true;
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => (copied = false), 1600);
        context.toast($_("native.walletFlows.addressCopied"));
    }

    async function copyUsername() {
        const username = $currentUserStore.username;
        if (await copyText(`@${username}`)) {
            context.toast($_("native.wallet.usernameCopied", { values: { username } }));
        }
    }

    function pick(id: string) {
        picking = false;
        if (id === chosen) return;
        chosen = id;
        account.selectedNetwork = undefined;
    }
</script>

<div class="flow">
    <NativePageHeader title={$_("native.walletFlows.receive")} onBack={context.back} />

    <div class="scroll">
        <FlowPicker
            placeholder={$_("native.walletFlows.chooseToken")}
            icon="wallet"
            onClick={() => (picking = true)}>
            {#if face !== undefined}
                <TokenAvatar size={40} symbol={face.symbol} mark={face.mark} gradient={face.grad} logo={face.logo} />
                <span class="names">
                    <span class="symbol">{face.symbol}</span>
                    <span class="meta">{network?.label ?? ""}</span>
                </span>
            {/if}
        </FlowPicker>

        {#if face !== undefined && network !== undefined}
            <div class="card">
                <div class="qr">
                    {#if address !== undefined}
                        <QRCode text={address} logo={face.logo} />
                    {:else if network.failed}
                        <p class="qr-note">{$_("native.walletFlows.addressFailed")}</p>
                    {:else}
                        <Spinner size={28} label={$_("native.walletFlows.addressLoading")} />
                    {/if}
                </div>
                {#if parts !== undefined}
                    <span class="address">{parts.head}<span class="middle">{parts.middle}</span>{parts.tail}</span>
                {/if}
                {#if networks.length > 1}
                    <button
                        type="button"
                        class="chip choosable"
                        aria-haspopup="menu"
                        aria-label={$_("native.walletFlows.chooseNetwork", { values: { network: network.label } })}
                        onclick={(e) => (networkAnchor = e.currentTarget)}>
                        <span class="dot"></span>{network.label}<span class="chip-chevron"></span>
                    </button>
                {:else}
                    <span class="chip"><span class="dot"></span>{network.label}</span>
                {/if}
            </div>

            <div class="warning">
                <span class="warning-icon" aria-hidden="true"></span>
                <span class="warning-text">
                    <span>
                        {$_("native.walletFlows.receiveWarning", {
                            values: { token: network.token ?? face.symbol, network: network.label },
                        })}
                    </span>
                    {#if network.note !== undefined}<span class="note">{network.note}</span>{/if}
                </span>
            </div>

            {#if $currentUserStore.username}
                <div class="handle">
                    <Avatar size={40} color={swatchFor($currentUserIdStore)} url={$allUsersStore.get($currentUserIdStore)?.blobUrl} />
                    <span class="handle-text">
                        <span class="handle-name">@{$currentUserStore.username}</span>
                        <span class="handle-sub">{$_("native.walletFlows.payByName")}</span>
                    </span>
                    <button
                        type="button"
                        class="copy-handle"
                        aria-label={$_("native.walletFlows.copyUsername")}
                        onclick={copyUsername}><span class="copy-icon"></span></button>
                </div>
            {/if}
        {/if}
    </div>

    {#if face !== undefined}
        <div class="foot">
            <Button
                label={$_(copied ? "native.walletFlows.copied" : "native.walletFlows.copyAddress")}
                icon="copy"
                size="lg"
                fullWidth
                disabled={address === undefined}
                onClick={copy} />
            <Button
                label={$_("native.walletFlows.share")}
                icon="share"
                variant="secondary"
                size="lg"
                fullWidth
                disabled={address === undefined}
                onClick={() => address !== undefined && shareText(address)} />
        </div>
    {/if}
</div>

<SupportedTokensSheet
    open={picking}
    {figures}
    title={$_("native.walletFlows.chooseToken")}
    selected={chosen}
    onClose={() => (picking = false)}
    onPick={pick} />

<AnchoredMenu
    anchor={networkAnchor}
    items={networks.map((n) => ({ id: n.id, label: n.label }))}
    label={$_("native.walletFlows.network")}
    onSelect={(id) => (account.selectedNetwork = id)}
    onClose={() => (networkAnchor = null)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .flow {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-8) var(--space-16) var(--space-16);
    }

    .names {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .symbol {
        font: var(--weight-bold) text-size(15.5px) / 1.1 var(--font-sans);
    }

    .meta {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .card {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 20px 18px 18px;
        border-radius: 20px;
        background: var(--overlay-1);
    }

    // the QR stays black on white in both themes, so it scans
    .qr {
        width: 216px;
        height: 216px;
        padding: 16px;
        box-sizing: border-box;
        border-radius: 18px;
        background: #fff;
        @include flex-center;
        color: #0b0b10;
    }

    .qr-note {
        margin: 0;
        text-align: center;
        font: var(--weight-medium) text-size(13px) / 1.4 var(--font-sans);
    }

    .address {
        padding: 0 var(--space-6);
        text-align: center;
        word-break: break-all;
        font: var(--weight-medium) text-size(14px) / 1.55 var(--font-mono);
        color: var(--ink);
    }

    .middle {
        color: var(--ink-3);
    }

    .chip {
        display: flex;
        align-items: center;
        gap: var(--space-6);
        height: 28px;
        padding: 0 11px;
        border: 0;
        border-radius: 14px;
        background: var(--tint-pill);
        color: var(--ink-2);
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);

        &.choosable {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;

            &:focus-visible {
                @include focus-ring;
            }
        }
    }

    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--status-online);
    }

    .chip-chevron {
        width: 12px;
        height: 12px;
        background: var(--ink-3);
        mask: var(--icon-chevron-down) center / contain no-repeat;
    }

    .warning {
        flex: none;
        display: flex;
        gap: var(--space-12);
        padding: var(--space-12) 14px;
        border-radius: 14px;
        background: color-mix(in oklch, var(--status-warning) 10%, transparent);
    }

    .warning-icon {
        flex: none;
        width: 17px;
        height: 17px;
        margin-top: 1px;
        background: var(--status-warning);
        mask: var(--icon-warning) center / contain no-repeat;
    }

    .warning-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
    }

    .note {
        color: var(--ink-3);
    }

    .handle {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-12) var(--space-8) var(--space-12) 14px;
        border-radius: var(--radius-lg);
        background: var(--overlay-1);
    }

    .handle-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .handle-name {
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
        color: var(--ink);
    }

    .handle-sub {
        font: var(--weight-regular) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .copy-handle {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        border: 0;
        background: none;
        @include flex-center;
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .copy-icon {
        width: 18px;
        height: 18px;
        background: var(--ink-3);
        mask: var(--icon-copy) center / contain no-repeat;
    }

    .foot {
        flex: none;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-8);
        padding: var(--space-12) var(--space-16) calc(var(--safe-bottom) + var(--space-16));
    }
</style>
