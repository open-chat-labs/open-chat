<!-- Tipping a message (5b), from its menu (starting on the token last sent) or a tip chip under it
     (starting on that chip's token, to tip again in it), as the old trees' TipBuilder: a token, then
     $0.01 / $0.10 / $1 steps (where the token has an exchange rate) or an amount typed in the token,
     what it is in dollars and the fee, the balance checked (TipForm, shared with both old dialogs).
     Sent with the PIN where the user has one: the client asks for it (the S3 PIN prompt, a small
     confirm over this dialog); given up, the tip stays here to send. The dialog closes once the tip
     has gone; a failure is toasted and the dialog stays. An empty account shows its address on the
     IC (ckBTC, ckSOL, a oneSec token's ICP network: no minter, no network fee, nothing to fetch),
     named, and a Refresh in Send's place, as the old desktop dialog did (which also offered the
     other networks). The token list replaces the form in place, with a back arrow. Pays from the OpenChat wallet only (GAPS, "Message actions": no external wallet).
     Never in an app store build (`disableTipsFeature`), where the menu and the chips don't offer it.
     TODO(design): the design has no tip dialog; DialogShell with the library's amount card. -->
<script lang="ts">
    import {
        cryptoTokensSorted,
        currentUserIdStore,
        currentUserStore,
        formatTokens,
        type OpenChat,
    } from "@client";
    import AmountCard from "@openchat/ui/src/lib/components/AmountCard.svelte";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import CopyButton from "@openchat/ui/src/lib/components/CopyButton.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import TokenPicker from "@openchat/ui/src/lib/components/TokenPicker.svelte";
    import { TIP_INCREMENTS, TipForm, type TipIncrement } from "@src/logic/tip/tipForm.svelte";
    import { ReceiveAccount } from "@src/logic/wallet/receiveAccount.svelte";
    import { icNetwork } from "@src/logic/wallet/receiveAddress";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { toastStore } from "@src/stores/toast";
    import { disableTipsFeature } from "@src/utils/features";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { tokenRef } from "../builders/builders.adapter";
    import { tipTokenOptions } from "./tip.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "tip_message" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const form = new TipForm(
        client,
        untrack(() => dialog.ledger),
        { onRefreshFailed: (failure) => toastStore.showFailureToast(failure) },
    );
    const tokenState = $derived(form.tokenState);

    // where the chosen token is deposited, for an empty account (the old dialogs' AccountInfo)
    const receive = new ReceiveAccount(
        client,
        () => form.tokenState.token,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );

    // the token's own account on the IC, never a native BTC / SOL or EVM address, whose network
    // and fees this dialog doesn't show (TokenPicker's own networks are the wallet's Receive)
    function depositOnIc() {
        receive.selectedNetwork = icNetwork(receive.networks);
    }
    depositOnIc();

    // what arrives at the address: ckBTC / ckSOL by their names, else the token
    const depositToken = $derived.by(() => {
        const network = receive.selectedNetwork;
        return (
            (network === undefined ? undefined : receive.arrivingToken(network)) ??
            tokenState.symbol
        );
    });

    // an app store build never tips (nothing offers it there)
    onMount(() => {
        if (disableTipsFeature) onClose();
    });

    // the token list in the form's place
    let picking = $state(false);
    // the amount as shown in the card: as typed, or the steps' total
    let amountText = $state("");
    let sending = $state(false);
    let refreshing = $state(false);

    const pill = $derived(tokenRef(tokenState.token));
    const options = $derived(tipTokenOptions($cryptoTokensSorted, form.ledger));

    const balance = $derived(
        `${$_("cryptoAccount.shortBalanceLabel")} ${formatTokens(
            tokenState.cryptoBalance,
            tokenState.decimals,
        )} ${tokenState.symbol}`,
    );

    // under the amount: not enough, what it is in dollars and the fee, or how to pick one
    const note = $derived.by(() => {
        // an empty account says so below the card
        if (form.zero) return "";
        if (form.insufficient) {
            return $_("tip.insufficient", { values: { token: tokenState.symbol } });
        }
        const fee = $_("tip.plusFee", {
            values: { fee: form.displayFee, token: tokenState.symbol },
        });
        if (form.exchangeRate <= 0) {
            const noRate = $_("tip.noExchangeRate", { values: { token: tokenState.symbol } });
            return tokenState.draftAmount > 0n ? `${noRate} · ${fee}` : noRate;
        }
        if (tokenState.draftAmount === 0n) return $_("tip.advice");
        return `$${(form.centAmount / 100).toFixed(2)} · ${fee}`;
    });

    function step(increment: TipIncrement): string {
        return `$${(increment / 100).toFixed(2)}`;
    }

    function add(increment: TipIncrement) {
        form.add(increment);
        amountText = form.displayDraftAmount;
    }

    function type(e: Event & { currentTarget: HTMLInputElement }) {
        const typed = e.currentTarget.value;
        const replacement = form.typeAmount(typed);
        amountText = replacement ?? typed;
        if (replacement !== undefined) e.currentTarget.value = replacement;
    }

    // another token starts the amount again (TransferForm), and checks its balance; the one already
    // chosen keeps the amount, and so its text
    function pick(ledger: string) {
        if (ledger !== form.ledger) {
            form.ledger = ledger;
            amountText = "";
            depositOnIc();
        }
        picking = false;
    }

    async function refresh() {
        refreshing = true;
        try {
            await form.refreshBalance();
        } finally {
            refreshing = false;
        }
    }

    async function send() {
        if (!form.valid || sending) return;
        sending = true;
        let outcome;
        try {
            outcome = await form.tip(dialog.context, dialog.message, dialog.recipient);
        } finally {
            sending = false;
        }
        switch (outcome.kind) {
            case "tipped":
                onClose();
                return;
            case "cancelled":
                // the PIN prompt given up: the tip stays here to send
                return;
            case "pin_failed":
                toastStore.showFailureToast(pinNumberErrorMessageStore);
                return;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                return;
        }
    }
</script>

{#if !disableTipsFeature}
    <DialogShell
        title={$_("tip.title")}
        width={440}
        height="auto"
        onBack={picking ? () => (picking = false) : undefined}
        {onClose}>
        {#if picking}
            <div class="picker">
                <TokenPicker tokens={options} onSelect={pick} />
            </div>
        {:else}
            <div class="body">
                <AmountCard
                    label={$_("tokenTransfer.amount")}
                    meta={balance}
                    value={amountText}
                    {note}
                    tone={form.insufficient ? "danger" : "default"}
                    symbol={pill.symbol}
                    mark={pill.mark}
                    gradient={pill.gradient}
                    position="alone"
                    onChange={type}
                    onTokenClick={() => (picking = true)} />
                {#if form.zero}
                    <Banner
                        tone="warning"
                        text={$_("tokenTransfer.zeroBalance", {
                            values: { token: tokenState.symbol },
                        })} />
                    <p class="advice">
                        {$_("tokenTransfer.yourAccount", { values: { token: depositToken } })}
                    </p>
                    {#if receive.address !== undefined}
                        <div class="address">
                            <span class="account">{receive.address}</span>
                            <CopyButton value={receive.address} variant="soft" />
                        </div>
                    {:else}
                        <p class="advice" class:failed={receive.failed}>
                            {receive.failed
                                ? $_("cryptoAccount.failedToGenerateAddress")
                                : $_("generating")}
                        </p>
                    {/if}
                    <p class="advice">{$_("tokenTransfer.makeDeposit")}</p>
                {:else if form.exchangeRate > 0}
                    <div class="steps">
                        {#each TIP_INCREMENTS as increment (increment)}
                            <Button
                                label={step(increment)}
                                variant="secondary"
                                fullWidth
                                disabled={!form.canAdd(increment)}
                                onClick={() => add(increment)} />
                        {/each}
                    </div>
                {/if}
                <div class="actions">
                    <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
                    {#if form.zero}
                        <Button
                            label={$_("refresh")}
                            busy={refreshing}
                            disabled={refreshing}
                            onClick={refresh} />
                    {:else}
                        <Button
                            label={$_("tokenTransfer.send")}
                            busy={sending}
                            disabled={!form.valid || sending}
                            onClick={send} />
                    {/if}
                </div>
            </div>
        {/if}
    </DialogShell>
{/if}

<style lang="scss">
    /* DialogShell's body is a grid: its item may not grow past it to fit its content */
    .body,
    .picker {
        min-width: 0;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
    }

    .picker {
        display: flex;
        flex-direction: column;
        max-height: min(480px, 70vh);
    }

    .steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-8);
    }

    .address {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-12);
        border-radius: var(--radius-md);
        background: var(--overlay-1);
    }

    .account {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-mono);
        color: var(--ink-2);
    }

    .advice {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);

        &.failed {
            color: var(--status-danger);
        }
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
