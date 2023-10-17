<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import type { NamedAccount, OpenChat } from "openchat-client";
    import { ICP_SYMBOL } from "openchat-client";
    import Input from "../../Input.svelte";
    import { _ } from "svelte-i18n";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import { toastStore } from "../../../stores/toast";
    import { iconSize } from "../../../stores/iconSize";
    import Scanner from "./Scanner.svelte";
    import SaveAccount from "./SaveAccount.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import { isAccountIdentifierValid, isPrincipalValid } from "openchat-shared";

    export let ledger: string;
    export let amountToSend: bigint;
    export let busy = false;
    export let valid = false;
    export let validAccountName = false;
    export let capturingAccount = false;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    let validAmount = false;
    let targetAccount: string = "";
    let scanner: Scanner;
    let accounts: NamedAccount[] = [];
    let saveAccountElement: SaveAccount;

    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: account = tokenDetails.symbol === ICP_SYMBOL ? user.cryptoAccount : user.userId;
    $: transferFees = tokenDetails.transferFee;
    $: symbol = tokenDetails.symbol;
    $: targetAccountValid = targetAccount.length > 0 &&
        targetAccount !== account &&
        (isPrincipalValid(targetAccount) || (symbol === "ICP" && isAccountIdentifierValid(targetAccount)))
    $: validSend = validAmount && targetAccountValid;
    $: {
        valid = capturingAccount ? validAccountName : validSend;
    }

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();
    });

    export function saveAccount() {
        return saveAccountElement?.saveAccount();
    }

    export function scan() {
        scanner?.scan();
    }

    function unknownAccount(account: string): boolean {
        return accounts.find((a) => a.account === account) === undefined;
    }

    export function send() {
        if (!valid) return;

        busy = true;
        dispatch("error", undefined);
        client
            .withdrawCryptocurrency({
                kind: "pending",
                ledger,
                token: symbol,
                to: targetAccount,
                amountE8s: amountToSend,
                feeE8s: transferFees,
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            })
            .then((resp) => {
                if (resp.kind === "completed") {
                    amountToSend = BigInt(0);
                    dispatch("refreshBalance");
                    toastStore.showSuccessToast("cryptoAccount.sendSucceeded", {
                        values: { symbol },
                    });
                    if (unknownAccount(targetAccount)) {
                        capturingAccount = true;
                    } else {
                        dispatch("close");
                        targetAccount = "";
                    }
                } else {
                    dispatch("error", "cryptoAccount.sendFailed");
                    client.logMessage(`Unable to withdraw ${symbol}`, resp);
                    toastStore.showFailureToast("cryptoAccount.sendFailed", { values: { symbol } });
                }
            })
            .catch((err) => {
                dispatch("error", "cryptoAccount.sendFailed");
                client.logError(`Unable to withdraw ${symbol}`, err);
                toastStore.showFailureToast("cryptoAccount.sendFailed", { values: { symbol } });
            })
            .finally(() => (busy = false));
    }
</script>

{#if capturingAccount}
    <SaveAccount
        bind:this={saveAccountElement}
        bind:valid={validAccountName}
        account={targetAccount}
        {accounts} />
{:else}
    <Scanner on:data={(ev) => (targetAccount = ev.detail)} bind:this={scanner} />

    <div class="token-input">
        <TokenInput
            {ledger}
            {transferFees}
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
            placeholder={$_("cryptoAccount.sendTarget")} />

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

<style lang="scss">
    :global(.target .input-wrapper input) {
        padding-right: 40px;
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
