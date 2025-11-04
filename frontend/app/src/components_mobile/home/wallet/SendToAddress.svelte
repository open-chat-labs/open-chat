<script lang="ts">
    import { CommonButton, Container, Input, InputIconButton } from "component-lib";
    import {
        BTC_SYMBOL,
        CKBTC_SYMBOL,
        type CkbtcMinterWithdrawalInfo,
        currentUserIdStore,
        currentUserStore,
        type EvmChain,
        ICP_SYMBOL,
        Lazy,
        type NamedAccount,
        type OneSecTransferFees,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { ErrorCode, isAccountIdentifierValid, isICRCAddressValid } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import { Debouncer } from "../../../utils/debouncer";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import NetworkSelector from "../NetworkSelector.svelte";
    import TokenInput from "../TokenInput.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import SaveAccount from "./SaveAccount.svelte";
    import Scanner from "./Scanner.svelte";
    import type { TokenState } from "./walletState.svelte";

    interface Props {
        tokenState: TokenState;
        onClose: () => void;
    }

    let { tokenState, onClose }: Props = $props();

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
    const ckbtcMinterInfoDebouncer = new Debouncer(getCkbtcMinterWithdrawalInfo, 500);

    let account = $derived(
        tokenState.symbol === ICP_SYMBOL ? $currentUserStore.cryptoAccount : $currentUserIdStore,
    );
    let selectedNetwork = $state<string>();
    let isBtc = $derived(tokenState.symbol === BTC_SYMBOL);
    let isBtcNetwork = $derived(selectedNetwork === BTC_SYMBOL);
    let oneSecEnabled = $derived(
        tokenState.token.oneSecEnabled && tokenState.token.evmContractAddresses.length > 0,
    );
    let isOneSecNetwork = $derived(oneSecEnabled && selectedNetwork !== ICP_SYMBOL);
    let networks = $derived.by(() => {
        if (isBtc) {
            return [BTC_SYMBOL, CKBTC_SYMBOL];
        } else if (oneSecEnabled) {
            return client.oneSecGetNetworks(tokenState.symbol);
        } else {
            return [];
        }
    });
    let targetAccountValid = $derived.by(() => {
        if (targetAccount.length === 0 || targetAccount === account) return false;
        if (isBtc) return targetAccount.length >= 14;
        if (isOneSecNetwork) return targetAccount.length === 42;
        if (isICRCAddressValid(targetAccount)) return true;
        if (tokenState.symbol === ICP_SYMBOL && isAccountIdentifierValid(targetAccount))
            return true;
        return false;
    });

    let oneSecFees = $state<OneSecTransferFees[]>();
    let oneSecFeesForToken = $derived.by(() => {
        if (!isOneSecNetwork || oneSecFees === undefined) return undefined;
        return oneSecFees.find(
            (f) => f.sourceToken === tokenState.symbol && f.destinationChain === selectedNetwork,
        );
    });

    let minAmount = $derived.by(() => {
        if (isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined) {
            return ckbtcMinterWithdrawalInfo.minWithdrawalAmount;
        }
        if (isOneSecNetwork && oneSecFeesForToken !== undefined) {
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

    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);
    let networkFee = $derived.by(() => {
        if (isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined) {
            return ckbtcMinterWithdrawalInfo.feeEstimate;
        } else if (isOneSecNetwork && oneSecFeesForToken !== undefined) {
            return (
                oneSecFeesForToken.latestTransferFee +
                (amountToSend * BigInt(100 * oneSecFeesForToken.protocolFeePercent)) / BigInt(10000)
            );
        } else {
            return undefined;
        }
    });
    let networkFeeFormatted = $derived(
        networkFee === undefined
            ? undefined
            : `~${client.formatTokens(networkFee, tokenState.decimals)}`,
    );

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
        } else if (isOneSecNetwork) {
            // Filter to where source token equals destination token since we're dealing with cross-chain withdrawals
            oneSecFeesPromise
                .get()
                .then(
                    (fees) =>
                        (oneSecFees = fees.filter(
                            (f) =>
                                f.sourceToken === f.destinationToken &&
                                f.sourceChain === ICP_SYMBOL,
                        )),
                );
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
            : isOneSecNetwork
              ? client.withdrawViaOneSec(
                    tokenState.ledger,
                    tokenState.symbol,
                    selectedNetwork as EvmChain,
                    targetAccount,
                    amountToSend,
                )
              : client.withdrawCryptocurrency({
                    kind: "pending",
                    ledger: tokenState.ledger,
                    token: tokenState.symbol,
                    to: targetAccount,
                    amountE8s: amountToSend,
                    feeE8s: tokenState.transferFees,
                    createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
                });

        withdrawTokensPromise
            .then((resp) => {
                if (resp.kind === "completed" || resp.kind === "success") {
                    amountToSend = BigInt(0);
                    toastStore.showSuccessToast(
                        i18nKey("cryptoAccount.sendSucceeded", {
                            symbol: tokenState.symbol,
                        }),
                    );
                    if (unknownAccount(targetAccount)) {
                        capturingAccount = true;
                    } else {
                        onClose();
                        targetAccount = "";
                    }
                } else if (resp.kind === "failed" || resp.kind === "error") {
                    error = i18nKey("cryptoAccount.sendFailed", { symbol: tokenState.symbol });
                    client.logMessage(`Unable to withdraw ${tokenState.symbol}`, resp);
                }
            })
            .catch((err) => {
                if (err !== "cancelled") {
                    error = i18nKey("cryptoAccount.sendFailed", { symbol: tokenState.symbol });
                    client.logError(`Unable to withdraw ${tokenState.symbol}`, err);
                }
            })
            .finally(() => (busy = false));
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

<Container gap={"md"} direction={"vertical"}>
    {#if capturingAccount}
        <SaveAccount
            bind:this={saveAccountElement}
            bind:valid={validAccountName}
            account={targetAccount}
            {accounts} />
    {:else}
        <Scanner onData={(data) => (targetAccount = data)} bind:this={scanner} />

        {#if networks.length > 0 && selectedNetwork !== undefined}
            <NetworkSelector {networks} bind:selectedNetwork />
        {/if}

        <Container gap={"xs"} direction={"vertical"}>
            <TokenInput
                ledger={tokenState.ledger}
                {minAmount}
                maxAmount={tokenState.maxAmount}
                bind:valid={validAmount}
                bind:amount={amountToSend} />
        </Container>

        <Input
            bind:value={targetAccount}
            countdown={false}
            maxlength={100}
            error={targetAccount.length > 0 && !targetAccountValid}
            placeholder={interpolate($_, i18nKey("cryptoAccount.sendTarget"))}>
            {#snippet iconButtons(color)}
                <InputIconButton onClick={scan}>
                    <QrcodeScan {color} />
                </InputIconButton>
            {/snippet}
        </Input>

        {#if accounts.length > 0 || networkFee !== undefined}
            <div class="lower-container">
                {#if accounts.length > 0}
                    <div class="accounts">
                        <AccountSelector bind:targetAccount {accounts} />
                    </div>
                {/if}

                {#if networkFeeFormatted !== undefined}
                    <div class="network-fee">
                        <Translatable
                            resourceKey={i18nKey("cryptoAccount.networkFee", {
                                amount: networkFeeFormatted,
                                token: tokenState.symbol,
                            })} />
                    </div>
                {/if}
            </div>
        {/if}
    {/if}

    {#if errorMessage !== undefined}
        <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
    {/if}
</Container>
<Container mainAxisAlignment={"end"} gap={"sm"}>
    <CommonButton onClick={onClose}>
        <Translatable resourceKey={i18nKey(capturingAccount ? "noThanks" : "cancel")} />
    </CommonButton>
    <CommonButton disabled={busy || !valid} loading={busy} mode={"active"} onClick={onPrimaryClick}>
        {#snippet icon(color)}
            <Send {color} />
        {/snippet}
        <Translatable
            resourceKey={i18nKey(
                capturingAccount ? "tokenTransfer.saveAccount" : "tokenTransfer.send",
            )} />
    </CommonButton>
</Container>

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
