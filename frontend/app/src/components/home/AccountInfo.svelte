<script lang="ts">
    import { cryptoLookup, currentUserIdStore, currentUserStore, OpenChat } from "@client";
    import { ReceiveAccount } from "@src/logic/wallet/receiveAccount.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import QRCode from "../QRCode.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import NetworkSelector from "./NetworkSelector.svelte";
    import { rtlStore } from "../../stores/rtl";

    interface Props {
        qrSize?: "default" | "smaller" | "larger";
        ledger: string;
        centered?: boolean;
        border?: boolean;
        fullWidthOnMobile?: boolean;
    }

    let {
        qrSize = "default",
        ledger,
        centered = false,
        border = true,
        fullWidthOnMobile = false,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    // the networks, the address on the chosen one and what depositing there costs (ReceiveAccount,
    // shared with the mobile tree and the web wallet)
    const receive = new ReceiveAccount(
        client,
        () => tokenDetails,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );
    let networks = $derived(receive.networks);
    let selectedNetwork = $derived(receive.selectedNetwork);
    let account = $derived(receive.address);
    let note = $derived(receive.depositNote);

    let tokenName = $derived.by(() => {
        if (selectedNetwork === undefined) return tokenDetails.symbol;
        // BTC / ckBTC and SOL / ckSOL are named after the network
        const arriving = receive.arrivingToken(selectedNetwork);
        if (arriving !== undefined) return arriving;
        return $rtlStore
            ? `(${selectedNetwork}) ${tokenDetails.symbol}`
            : `${tokenDetails.symbol} (${selectedNetwork})`;
    });
</script>

<div class="account-info">
    {#if networks.length > 0 && selectedNetwork !== undefined}
        <NetworkSelector
            {networks}
            bind:selectedNetwork={
                () => selectedNetwork ?? "", (v) => (receive.selectedNetwork = v)
            } />
    {/if}

    {#if account === undefined}
        <div class="generating">
            {#if receive.failed}
                <div class="error-icon"></div>
            {:else}
                <div class="spinner"></div>
            {/if}
        </div>
    {:else}
        <QRCode
            {fullWidthOnMobile}
            text={account}
            size={qrSize}
            logo={tokenDetails.logo}
            {border} />
    {/if}
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: tokenName })} />
    </p>
    {#if account === undefined}
        {#if receive.failed}
            <span class="error-label">{$_("cryptoAccount.failedToGenerateAddress")}</span>
        {:else}
            <span class="label">{$_("generating")}</span>
        {/if}
    {:else}
        <TruncatedAccount {centered} {account} />
    {/if}

    {#if note.kind === "loading"}
        <span class="label">{$_("cryptoAccount.fetchingDepositFee")}</span>
    {:else if note.kind === "failed"}
        <span class="error-label">{$_("cryptoAccount.failedToFetchDepositFee")}</span>
    {:else if note.kind === "btc" || note.kind === "one_sec"}
        <span class="label"
            >{$_("cryptoAccount.networkFee", {
                values: { amount: note.fee, token: tokenDetails.symbol },
            })}</span>
    {:else if note.kind === "sol"}
        {#if note.minimum !== undefined}
            <span class="label"
                >{$_("cryptoAccount.minimumDeposit", {
                    values: { amount: note.minimum, token: tokenDetails.symbol },
                })}</span>
        {/if}
        <span class="label"
            >{$_("cryptoAccount.solDepositFee", {
                values: {
                    first: note.firstFee,
                    subsequent: note.laterFee,
                    token: tokenDetails.symbol,
                },
            })}</span>
    {/if}
</div>

<style lang="scss">
    .centered {
        text-align: center;
    }

    .account-info {
        display: flex;
        flex-direction: column;
        margin-bottom: $sp4;
        align-items: center;
    }

    .your-account {
        margin-top: $sp4;
    }

    .generating {
        height: 298px;
        width: 298px;
        border: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        @include loading-spinner(4rem, 2rem, var(--button-spinner), "/assets/spinner.svg");
        flex: 0 0 toRem(24);
    }

    .label {
        color: var(--unread-mute-txt);
    }

    .error-icon {
        background-image: url("/assets/dead-bot.svg");
        height: 4rem;
        width: 4rem;
    }

    .error-label {
        color: var(--error);
    }
</style>
