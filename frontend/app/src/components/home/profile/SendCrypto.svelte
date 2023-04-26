<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import TokenInput from "../TokenInput.svelte";
    import { Cryptocurrency, OpenChat, cryptoLookup } from "openchat-client";
    import Input from "../../Input.svelte";
    import { _ } from "svelte-i18n";
    import Send from "svelte-material-icons/Send.svelte";
    import { logger } from "../../../utils/logging";
    import { toastStore } from "../../../stores/toast";
    import { iconSize } from "../../../stores/iconSize";
    import Scanner from "./Scanner.svelte";

    export let token: Cryptocurrency;
    export let amountToSendE8s: bigint;
    export let scanningUnsupported: Boolean;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    let validAmount = false;
    let targetAccount: string = "";
    let sending = false;
    let scanner: Scanner;

    $: account = token === "icp" ? user.cryptoAccount : user.userId;
    $: cryptoBalance = client.cryptoBalance;
    $: transferFees = cryptoLookup[token].transferFeesE8s;
    $: valid =
        validAmount &&
        amountToSendE8s > BigInt(0) &&
        targetAccount !== "" &&
        targetAccount !== account;
    $: symbol = cryptoLookup[token].symbol;

    export function scan() {
        scanner?.scan();
    }

    function send() {
        if (!valid) return;

        sending = true;
        dispatch("error", undefined);
        client
            .withdrawCryptocurrency({
                kind: "pending",
                token,
                to: targetAccount,
                amountE8s: amountToSendE8s,
                feeE8s: transferFees,
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            })
            .then((resp) => {
                if (resp.kind === "completed") {
                    amountToSendE8s = BigInt(0);
                    targetAccount = "";
                    dispatch("refreshBalance");
                    toastStore.showSuccessToast("cryptoAccount.sendSucceeded", { values: { symbol } });
                } else {
                    dispatch("error", "cryptoAccount.sendFailed");
                    logger.error(`Unable to withdraw ${symbol}`, resp);
                    toastStore.showFailureToast("cryptoAccount.sendFailed", { values: { symbol } });
                }
            })
            .catch((err) => {
                dispatch("error", "cryptoAccount.sendFailed");
                logger.error(`Unable to withdraw ${symbol}`, err);
                toastStore.showFailureToast("cryptoAccount.sendFailed", { values: { symbol } });
            })
            .finally(() => (sending = false));
    }
</script>

{#if !scanningUnsupported}
    <Scanner on:data={(ev) => (targetAccount = ev.detail)} bind:this={scanner} />
{/if}

<div class="token-input">
    <TokenInput
        {token}
        maxAmountE8s={BigInt(Math.max(0, Number($cryptoBalance[token] - transferFees)))}
        bind:valid={validAmount}
        bind:amountE8s={amountToSendE8s} />
</div>
<div class="target">
    <Input
        bind:value={targetAccount}
        countdown={false}
        maxlength={100}
        placeholder={$_("cryptoAccount.sendTarget")} />

    <div class="send" class:valid on:click={send} class:sending>
        {#if !sending}
            <Send size={$iconSize} color={valid ? "var(--icon-selected)" : "var(--icon-txt)"} />
        {/if}
    </div>
</div>

<style type="text/scss">
    :global(.target .input-wrapper input) {
        padding-right: 40px;
    }

    .token-input {
        margin-bottom: $sp3;
    }
    .target {
        margin-bottom: $sp3;
        position: relative;

        .send {
            position: absolute !important;
            top: 10px;
            right: $sp3;

            &.valid {
                cursor: pointer;
            }

            &.sending {
                @include loading-spinner(
                    1em,
                    0.5em,
                    var(--button-spinner),
                    "../assets/plain-spinner.svg"
                );
                top: 21px;
                right: 20px;
            }
        }
    }
</style>
