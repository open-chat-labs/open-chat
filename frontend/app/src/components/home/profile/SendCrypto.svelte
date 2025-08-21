<script lang="ts">
    import {
        type CkbtcMinterWithdrawalInfo,
        type EvmChain, Lazy,
        type NamedAccount, type OneSecTransferFees,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import {
        ARBITRUM_NETWORK,
        BASE_NETWORK,
        BTC_SYMBOL,
        CKBTC_SYMBOL,
        cryptoBalanceStore,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        ETHEREUM_NETWORK,
        iconSize,
        ICP_SYMBOL,
        mobileWidth,
    } from "openchat-client";
    import { ErrorCode, isAccountIdentifierValid, isPrincipalValid } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import { Debouncer } from "../../../utils/debouncer";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import NetworkSelector from "../NetworkSelector.svelte";
    import TokenInput from "../TokenInput.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import SaveAccount from "./SaveAccount.svelte";
    import Scanner from "./Scanner.svelte";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = $state();
    let amountToSend: bigint = $state(0n);
    let ckbtcMinterWithdrawalInfo = $state<CkbtcMinterWithdrawalInfo>();
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

    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let account = $derived(
        tokenDetails?.symbol === ICP_SYMBOL ? $currentUserStore.cryptoAccount : $currentUserIdStore,
    );
    let symbol = $derived(tokenDetails.symbol);
    let selectedNetwork = $state<string>();
    let isBtc = $derived(symbol === BTC_SYMBOL);
    let isBtcNetwork = $derived(selectedNetwork === BTC_SYMBOL);
    let isOneSec = $derived(tokenDetails.oneSecEnabled);
    let networks = $derived.by(() => {
        if (isBtc) {
            return [BTC_SYMBOL, CKBTC_SYMBOL];
        } else if (isOneSec) {
            return [ETHEREUM_NETWORK, ARBITRUM_NETWORK, BASE_NETWORK];
        } else {
            return [];
        }
    });
    let transferFees = $derived(tokenDetails?.transferFee ?? 0n);
    let targetAccountValid = $derived.by(() => {
        if (targetAccount.length === 0 || targetAccount === account) return false;
        if (isBtc) return targetAccount.length >= 14;
        if (isOneSec) return targetAccount.length === 42;
        if (isPrincipalValid(targetAccount)) return true;
        if (symbol === ICP_SYMBOL && isAccountIdentifierValid(targetAccount)) return true;
        return false;
    });

    let oneSecFees = $state<OneSecTransferFees[]>();
    let oneSecFeesForToken = $derived.by(() => {
        if (!isOneSec || oneSecFees === undefined) return undefined;
        return oneSecFees.find((f) => f.sourceToken === tokenDetails.symbol && f.destinationChain === selectedNetwork);
    });

    let minAmount = $derived.by(() => {
        if (isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined) {
            return ckbtcMinterWithdrawalInfo.minWithdrawalAmount;
        }
        if (isOneSec && oneSecFeesForToken !== undefined) {
            return oneSecFeesForToken.minAmount;
        }
        return BigInt(0);
    });
    let validSend = $derived(validAmount && targetAccountValid);
    $effect(() => {
        // If sending via the BTC network we must wait until the ckbtc minter info is loaded to correctly apply the min amount
        valid =
            (capturingAccount ? validAccountName : validSend) &&
            (!isBtcNetwork || ckbtcMinterWithdrawalInfo !== undefined);
    });
    let title = $derived(i18nKey("cryptoAccount.sendToken", { symbol }));

    let remainingBalance = $derived(
        amountToSend > BigInt(0) ? cryptoBalance - amountToSend - transferFees : cryptoBalance,
    );

    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);
    let networkFee = $derived.by(() => {
        if (isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined) {
            return ckbtcMinterWithdrawalInfo.feeEstimate;
        } else if (isOneSec && oneSecFeesForToken !== undefined) {
            return oneSecFeesForToken.latestTransferFee + (amountToSend * BigInt(100 * oneSecFeesForToken.protocolFeePercent) / BigInt(10000));
        } else {
            return undefined;
        }
    });
    let networkFeeFormatted = $derived(networkFee === undefined ? undefined : `~${client.formatTokens(networkFee, tokenDetails.decimals)}`);

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();

        if (isBtc) {
            getCkbtcMinterWithdrawalInfo(BigInt(0));
        }
    });

    // Whenever the networks list changes, autoselect the first one
    $effect(() => {
        selectedNetwork = networks[0];
    });

    const oneSecFeesPromise = new Lazy(() => client.oneSecGetTransferFees());
    $effect(() => {
        if (isBtcNetwork) {
            ckbtcMinterInfoDebouncer.execute(amountToSend);
        } else if (isOneSec) {
            // Filter to where source token equals destination token since we're dealing with cross-chain withdrawals
            oneSecFeesPromise.get().then((fees) =>
                oneSecFees = fees.filter((f) => f.sourceToken === f.destinationToken && f.sourceChain === ICP_SYMBOL));
        }
    });

    function getCkbtcMinterWithdrawalInfo(amountToSend: bigint) {
        client
            .getCkbtcMinterWithdrawalInfo(amountToSend)
            .then((i) => (ckbtcMinterWithdrawalInfo = i));
    }

    function saveAccount() {
        if (saveAccountElement !== undefined) {
            saveAccountElement
                .saveAccount()
                .then((resp) => {
                    if (resp.kind === "success") {
                        onClose();
                    } else if (resp.kind === "error" && resp.code === ErrorCode.NameTaken) {
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
            : isOneSec
                ? client.withdrawViaOneSec(ledger, symbol, selectedNetwork as EvmChain, targetAccount, amountToSend)
                : client.withdrawCryptocurrency({
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
                } else if (resp.kind === "failed" || resp.kind === "error") {
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

    function onBalanceRefreshError(err: string) {
        error = i18nKey(err);
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
                onRefreshed={onBalanceRefreshed}
                onError={onBalanceRefreshError} />
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
                <Scanner onData={(data) => (targetAccount = data)} bind:this={scanner} />

                {#if networks.length > 0 && selectedNetwork !== undefined}
                    <NetworkSelector {networks} bind:selectedNetwork={selectedNetwork} />
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

                {#if accounts.length > 0 || networkFee !== undefined}
                    <div class="lower-container">
                        {#if accounts.length > 0}
                            <div class="accounts">
                                <AccountSelector bind:targetAccount {accounts} />
                            </div>
                        {/if}

                        {#if networkFeeFormatted !== undefined}
                            <div class="network-fee">
                                <Translatable resourceKey={i18nKey("cryptoAccount.networkFee", {
                                    amount: networkFeeFormatted,
                                    token: symbol,
                                })} />
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
                <Button secondary tiny={$mobileWidth} onClick={onClose}
                    ><Translatable
                        resourceKey={i18nKey(capturingAccount ? "noThanks" : "cancel")} /></Button>
                <Button
                    disabled={busy || !valid}
                    loading={busy}
                    tiny={$mobileWidth}
                    onClick={onPrimaryClick}
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

    .network-fee {
        @include font(book, normal, fs-60);
        margin-left: auto;
    }
</style>
