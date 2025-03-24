<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
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
    import ModalContent from "../../ModalContentLegacy.svelte";
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

    export let ledger: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let error: ResourceKey | undefined = undefined;
    let amountToSend: bigint;
    let ckbtcMinterWithdrawalInfo: CkbtcMinterWithdrawalInfo | undefined = undefined;
    let busy = false;
    let valid = false;
    let validAccountName = false;
    let capturingAccount = false;
    let validAmount = false;
    let targetAccount: string = "";
    let scanner: Scanner;
    let accounts: NamedAccount[] = [];
    let saveAccountElement: SaveAccount;
    let balanceWithRefresh: BalanceWithRefresh;
    const ckbtcMinterInfoDebouncer = new Debouncer(getCkbtcMinterWithdrawalInfo, 500);

    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: tokenDetails = $cryptoLookup[ledger];
    $: account = tokenDetails.symbol === ICP_SYMBOL ? $user.cryptoAccount : $user.userId;
    $: symbol = tokenDetails.symbol;
    $: selectedBtcNetwork = BTC_SYMBOL;
    $: isBtc = symbol === BTC_SYMBOL;
    $: isBtcNetwork = isBtc && selectedBtcNetwork === BTC_SYMBOL;
    // For BTC network transfers the ckBTC transfer fee is paid twice because the transfer is made via ICRC2
    // (approve + transfer_from). The BTC network fees are then taken out of the transfer amount.
    $: transferFees = isBtcNetwork ? BigInt(2) * tokenDetails.transferFee : tokenDetails.transferFee;
    $: targetAccountValid =
        targetAccount.length > 0 &&
        targetAccount !== account &&
        isBtcNetwork
            ? targetAccount.length >= 14
            : (
                isPrincipalValid(targetAccount) ||
                (symbol === ICP_SYMBOL && isAccountIdentifierValid(targetAccount))
            );
    $: minAmount = isBtcNetwork && ckbtcMinterWithdrawalInfo !== undefined ? ckbtcMinterWithdrawalInfo.minWithdrawalAmount : BigInt(0);
    $: validSend = validAmount && targetAccountValid;
    $: {
        // If sending via the BTC network we must wait until the ckbtc minter info is loaded to correctly apply the min amount
        valid = (capturingAccount ? validAccountName : validSend) && (!isBtcNetwork || ckbtcMinterWithdrawalInfo !== undefined);
    }
    $: title = i18nKey("cryptoAccount.sendToken", { symbol });

    $: remainingBalance =
        amountToSend > BigInt(0) ? cryptoBalance - amountToSend - transferFees : cryptoBalance;

    $: errorMessage = error !== undefined ? error : $pinNumberErrorMessageStore;

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();

        if (isBtc) {
            getCkbtcMinterWithdrawalInfo(BigInt(0));
        }
    });

    $: {
        if (isBtcNetwork && amountToSend > 0) {
            ckbtcMinterInfoDebouncer.execute(amountToSend);
        }
    }

    function getCkbtcMinterWithdrawalInfo(amountToSend: bigint) {
        client.getCkbtcMinterWithdrawalInfo(amountToSend).then((i) => ckbtcMinterWithdrawalInfo = i);
    }

    function saveAccount() {
        if (saveAccountElement !== undefined) {
            saveAccountElement
                .saveAccount()
                .then((resp) => {
                    if (resp.kind === "success") {
                        dispatch("close");
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
                        dispatch("close");
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
    <span class="header" slot="header">
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
    <form class="body" slot="body">
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

                <div class="qr" on:click={scan}>
                    <QrcodeScan size={$iconSize} color={"var(--icon-selected)"} />
                </div>
            </div>

            {#if accounts.length > 0}
                <div class="accounts">
                    <AccountSelector bind:targetAccount {accounts} />
                </div>
            {/if}
        {/if}

        {#if errorMessage !== undefined}
            <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
        {/if}
    </form>
    <span slot="footer">
        <ButtonGroup>
            <Button secondary tiny={$mobileWidth} on:click={() => dispatch("close")}
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
        margin-bottom: $sp3;
        position: relative;

        .qr {
            position: absolute !important;
            top: 10px;
            right: $sp3;
            cursor: pointer;
        }
    }
</style>
