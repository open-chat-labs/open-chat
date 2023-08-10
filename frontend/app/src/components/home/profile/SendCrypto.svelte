<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import type { OpenChat } from "openchat-client";
    import { ICP_SYMBOL } from "openchat-client";
    import Input from "../../Input.svelte";
    import { _ } from "svelte-i18n";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import { toastStore } from "../../../stores/toast";
    import { iconSize } from "../../../stores/iconSize";
    import Scanner from "./Scanner.svelte";

    export let ledger: string;
    export let amountToSend: bigint;
    export let sending = false;
    export let valid = false;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    let validAmount = false;
    let targetAccount: string = "";
    let scanner: Scanner;

    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: account = tokenDetails.symbol === ICP_SYMBOL ? user.cryptoAccount : user.userId;
    $: transferFees = tokenDetails.transferFee;
    $: symbol = tokenDetails.symbol;
    $: {
        valid =
            validAmount &&
            amountToSend > BigInt(0) &&
            targetAccount !== "" &&
            targetAccount !== account;
    }

    export function scan() {
        scanner?.scan();
    }

    export function send() {
        if (!valid) return;

        sending = true;
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
                    targetAccount = "";
                    dispatch("refreshBalance");
                    toastStore.showSuccessToast("cryptoAccount.sendSucceeded", {
                        values: { symbol },
                    });
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
            .finally(() => (sending = false));
    }
</script>

<Scanner on:data={(ev) => (targetAccount = ev.detail)} bind:this={scanner} />

<div class="token-input">
    <TokenInput
        {ledger}
        maxAmount={BigInt(Math.max(0, Number(cryptoBalance - transferFees)))}
        bind:valid={validAmount}
        bind:amount={amountToSend} />
</div>
<div class="target">
    <Input
        bind:value={targetAccount}
        countdown={false}
        maxlength={100}
        placeholder={$_("cryptoAccount.sendTarget")} />

    <div class="qr" on:click={scan}>
        <QrcodeScan size={$iconSize} color={"var(--icon-selected)"} />
    </div>
</div>

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
