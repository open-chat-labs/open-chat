<script lang="ts">
    import { getContext, onMount } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import type { CkbtcMinterWithdrawalInfo, NamedAccount, OpenChat, ResourceKey } from "openchat-client";
    import {
        BTC_SYMBOL,
        ICP_SYMBOL,
        currentUser as user,
        cryptoBalance as cryptoBalanceStore,
        cryptoLookup,
    } from "openchat-client";
    import Input from "../../Input.svelte";
    import { _ } from "svelte-i18n";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import { toastStore } from "../../../stores/toast";
    import { iconSize } from "../../../stores/iconSize";
    import Scanner from "./Scanner.svelte";
    import SaveAccount from "./SaveAccount.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import { isAccountIdentifierValid, isPrincipalValid } from "openchat-shared";
    import ModalContent from "../../ModalContent.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import BitcoinNetworkSelector from "../BitcoinNetworkSelector.svelte";
    import { Debouncer } from "../../../utils/debouncer";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = $state(undefined);
    let amountToSend: bigint = $state(0n);
    let ckbtcMinterWithdrawalInfo = $state<CkbtcMinterWithdrawalInfo | undefined>(undefined);
    let busy = $state(false);
    let valid = $state(false);
    let validAccountName = $state(false);
    let capturingAccount = $state(false);
    let validAmount = $state(false);
    let targetAccount: string = $state("");
    let scanner: Scanner;
    let accounts: NamedAccount[] = $state([]);
    let saveAccountElement: SaveAccount;
    let balanceWithRefresh: BalanceWithRefresh;
    const ckbtcMinterInfoDebouncer = new Debouncer(getCkbtcMinterWithdrawalInfo, 500);

    let cryptoBalance = $derived($cryptoBalanceStore[ledger] ?? BigInt(0));
    let tokenDetails = $derived($cryptoLookup[ledger]);
    let account = $derived(tokenDetails.symbol === ICP_SYMBOL ? $user.cryptoAccount : $user.userId);
    let symbol = $derived(tokenDetails.symbol);
    let selectedBtcNetwork = $state(BTC_SYMBOL);
    let isBtc = $derived(symbol === BTC_SYMBOL);
    let isBtcNetwork = $derived(isBtc && selectedBtcNetwork === BTC_SYMBOL);
    let transferFees = $derived(isBtcNetwork ? 0n : tokenDetails.transferFee);
    let targetAccountValid = $derived(
        targetAccount.length > 0 &&
        targetAccount !== account &&
        isBtcNetwork
            ? targetAccount.length >= 14
            : (
                isPrincipalValid(targetAccount) ||
                (symbol === ICP_SYMBOL && isAccountIdentifierValid(targetAccount))
            ));
    let minAmount = $derived(isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined ? ckbtcMinterWithdrawalInfo.minWithdrawalAmount : BigInt(0));
    let validSend = $derived(validAmount && targetAccountValid);
    $effect(() => {
        // If sending via the BTC network we must wait until the ckbtc minter info is loaded to correctly apply the min amount
        valid = (capturingAccount ? validAccountName : validSend) && (!isBtcNetwork || ckbtcMinterWithdrawalInfo !== undefined);
    });
    let title = $derived(i18nKey("cryptoAccount.sendToken", { symbol }));

    let remainingBalance = $derived(
        amountToSend > BigInt(0) ? cryptoBalance - amountToSend - transferFees : cryptoBalance,
    );

    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);
    let btcNetworkFee = $derived(isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined
        ? client.formatTokens(ckbtcMinterWithdrawalInfo.feeEstimate, 8)
        : undefined);

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();

        if (isBtc) {
            getCkbtcMinterWithdrawalInfo(BigInt(0));
        }
    });

    $effect(() => {
        if (isBtcNetwork && amountToSend > 0) {
            ckbtcMinterInfoDebouncer.execute(amountToSend);
        }
    });

    function getCkbtcMinterWithdrawalInfo(amountToSend: bigint) {
        client.getCkbtcMinterWithdrawalInfo(amountToSend).then((i) => ckbtcMinterWithdrawalInfo = i);
    }

    function saveAccount() {
        if (saveAccountElement !== undefined) {
            saveAccountElement
                .saveAccount()
                .then((resp) => {
                    if (resp.kind === "success") {
                        onClose();
                    } else if (resp.kind === "name_taken") {
                        error = i18nKey("tokenTransfer.accountNameTaken");
                    } else {
                        error = i18nKey("tokenTransfer.failedToSaveAccount");
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function scan() {
        scanner?.scan();
    }

    function unknownAccount(account: string): boolean {
        return accounts.find((a) => a.account === account) === undefined;
    }

    function send() {
        if (!valid) return;

        busy = true;
        error = undefined;

        const withdrawTokensPromise = isBtcNetwork
            ? client.withdrawBtc(targetAccount, amountToSend)
            : client
                .withdrawCryptocurrency({
                    kind: "pending",
                    ledger,
                    token: symbol,
                    to: targetAccount,
                    amountE8s: amountToSend,
                    feeE8s: transferFees,
                    createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
                });

        withdrawTokensPromise
            .then((resp) => {
                if (resp.kind === "completed" || resp.kind === "success") {
                    amountToSend = BigInt(0);
                    balanceWithRefresh.refresh();
                    toastStore.showSuccessToast(
                        i18nKey("cryptoAccount.sendSucceeded", {
                            symbol,
                        }),
                    );
                    if (unknownAccount(targetAccount)) {
                        capturingAccount = true;
                    } else {
                        onClose();
                        targetAccount = "";
                    }
                } else if (resp.kind === "failed" || resp.kind === "currency_not_supported") {
                    error = i18nKey("cryptoAccount.sendFailed", { symbol });
                    client.logMessage(`Unable to withdraw ${symbol}`, resp);
                }
            })
            .catch((err) => {
                if (err !== "cancelled") {
                    error = i18nKey("cryptoAccount.sendFailed", { symbol });
                    client.logError(`Unable to withdraw ${symbol}`, err);
                }
            })
            .finally(() => (busy = false));
    }

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = i18nKey(ev.detail);
    }

    function onPrimaryClick() {
        busy = true;
        if (capturingAccount) {
            saveAccount();
        } else {
            send();
        }
    }
</script>

<ModalContent>
    {#snippet header()}
        <span class="header">
            <div class="main-title"><Translatable resourceKey={title} /></div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {ledger}
                value={remainingBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if capturingAccount}
                <SaveAccount
                    bind:this={saveAccountElement}
                    bind:valid={validAccountName}
                    account={targetAccount}
                    {accounts} />
            {:else}
                <Scanner on:data={(ev) => (targetAccount = ev.detail)} bind:this={scanner} />

                {#if isBtc}
                    <BitcoinNetworkSelector bind:selectedNetwork={selectedBtcNetwork} />
                {/if}

                <div class="token-input">
                    <TokenInput
                        {ledger}
                        {transferFees}
                        {minAmount}
                        maxAmount={BigInt(Math.max(0, Number(cryptoBalance - transferFees)))}
                        bind:valid={validAmount}
                        bind:amount={amountToSend} />
                </div>
                <div class="target">
                    <Input
                        bind:value={targetAccount}
                        countdown={false}
                        maxlength={100}
                        invalid={targetAccount.length > 0 && !targetAccountValid}
                        placeholder={i18nKey("cryptoAccount.sendTarget")} />

                    <div class="qr" onclick={scan}>
                        <QrcodeScan size={$iconSize} color={"var(--icon-selected)"} />
                    </div>
                </div>

                {#if accounts.length > 0 || btcNetworkFee !== undefined}
                    <div class="lower-container">
                        {#if accounts.length > 0}
                            <div class="accounts">
                                <AccountSelector bind:targetAccount {accounts} />
                            </div>
                        {/if}

                        {#if btcNetworkFee !== undefined}
                            <div class="btc-network-fee">
                                <Translatable resourceKey={i18nKey("cryptoAccount.btcNetworkFee", { amount: btcNetworkFee })} />
                            </div>
                        {/if}
                    </div>
                {/if}
            {/if}

            {#if errorMessage !== undefined}
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                <Button secondary tiny={$mobileWidth} on:click={onClose}
                    ><Translatable
                        resourceKey={i18nKey(capturingAccount ? "noThanks" : "cancel")} /></Button>
                <Button
                    disabled={busy || !valid}
                    loading={busy}
                    tiny={$mobileWidth}
                    on:click={onPrimaryClick}
                    ><Translatable
                        resourceKey={i18nKey(
                            capturingAccount ? "tokenTransfer.saveAccount" : "tokenTransfer.send",
                        )} /></Button>
            </ButtonGroup>
        </span>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.target .input-wrapper input) {
        padding-right: 40px;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }

    .body {
        display: flex;
        flex-direction: column;
    }

    .token-input {
        margin-bottom: $sp3;
    }

    .target {
        position: relative;

        .qr {
            position: absolute !important;
            top: 10px;
            right: $sp3;
            cursor: pointer;
        }
    }

    .lower-container {
        display: flex;
        justify-content: space-between;
    }

    .btc-network-fee {
        @include font(light, normal, fs-60);
        color: var(--txt-light);
        margin-left: auto;
    }
</style>
