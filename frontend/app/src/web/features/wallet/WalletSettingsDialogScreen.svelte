<!-- The wallet's settings (6d #10123), from the panel's ⋯ menu: which tokens the wallet lists
     (automatic by a minimum value, or hand-picked), the transfer PIN and the display currency.
     The token list is WalletSettingsForm's copy of the stored config, saved when the dialog closes
     and only if it changed (a failure toasts). The PIN goes through PinNumberForm, as in the old
     wallets: turning it off or changing it needs the current PIN. The display currency is kept on
     this device (walletCurrency). -->
<script lang="ts">
    import {
        cryptoLookup,
        defaultWalletLedgers,
        pinNumberFailureStore,
        pinNumberRequiredStore,
        walletConfigStore,
        type OpenChat,
    } from "@client";
    import WalletSettingsDialog, {
        type WalletSettings,
    } from "@openchat/ui/src/features/components/WalletSettingsDialog.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { PinNumberForm } from "@src/logic/pin/pinNumberForm.svelte";
    import { WalletSettingsForm } from "@src/logic/wallet/walletSettingsForm.svelte";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { walletCurrency } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import type { PinOperation } from "@src/stores/pinNumber";
    import { getContext, onDestroy, onMount } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { walletCatalogue } from "./walletCatalogue.svelte";

    let { onClose }: DialogProps<Extract<LocalDialog, { kind: "wallet_settings" }>> = $props();

    const client = getContext<OpenChat>("client");

    const form = new WalletSettingsForm(
        client,
        () => walletConfigStore.value,
        () => defaultWalletLedgers($cryptoLookup.values()),
    );

    // the tokens the wallet doesn't list yet may hold something to hand-pick: their balances are
    // refreshed as the dialog opens, as the old desktop settings do
    onMount(() => {
        for (const token of $cryptoLookup.values()) {
            if (!token.enabled) client.refreshAccountBalance(token.ledger, true);
        }
    });

    // saved when the dialog closes, however it closes
    onDestroy(() => void save());

    async function save(): Promise<void> {
        const outcome = await form.save();
        if (outcome === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.configureWalletFailure"));
        } else if (outcome === "invalid") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.invalidMinimum"));
        }
    }

    // the minimum as last typed, shown as typed ("1.", ".", "" stay so) until the mode changes;
    // only a number reaches the form
    let typedMinimum = $state<string>();
    const value = $derived.by((): Partial<WalletSettings> => {
        const config = form.config;
        const minimum =
            config.kind === "auto_wallet" ? (typedMinimum ?? String(config.minDollarValue)) : "";
        return {
            pinOn: $pinNumberRequiredStore ?? false,
            autoConfig: config.kind === "auto_wallet",
            minBalance: minimum,
            tokens: config.kind === "manual_wallet" ? [...config.tokens] : [],
            currency: currencyOf($walletCurrency),
        };
    });

    function currencyOf(c: string): WalletSettings["currency"] {
        return c === "BTC" || c === "ETH" || c === "ICP" ? c : "USD";
    }

    // the dialog applies as it goes: a mode switch starts that mode (WalletSettingsForm), a pick or
    // a minimum edits the copy, the currency is kept at once. Turning automatic off (the toggle,
    // or "take over") hands over the tokens it showed, which the hand-picked list starts from; with
    // none, it starts from the default tokens
    function changed(next: WalletSettings): void {
        if (next.currency !== $walletCurrency) walletCurrency.set(next.currency);
        const auto = form.config.kind === "auto_wallet";
        if (next.autoConfig !== auto) {
            typedMinimum = undefined;
            form.selectMode(next.autoConfig ? "auto_wallet" : "manual_wallet");
            if (!next.autoConfig && next.tokens.length > 0) form.setTokens(next.tokens);
        } else if (auto) {
            typedMinimum = next.minBalance;
            const minimum = Number(next.minBalance || "0");
            if (!isNaN(minimum)) form.setMinimum(minimum);
        } else {
            form.setTokens(next.tokens);
        }
    }

    // the PIN, as PinNumberForm sets, changes and clears it; a refusal keeps the dialog's sheet
    // open with its error. Only a lockout this call ran into (too many wrong PINs: how long to
    // wait) is also a toast; setPinNumber clears any earlier failure as it starts
    async function pin(
        operation: PinOperation,
        current: string | undefined,
        next: string | undefined,
    ): Promise<void> {
        const pinForm = new PinNumberForm(client, operation);
        pinForm.currentPin = current?.split("") ?? [];
        pinForm.newPin = next?.split("") ?? [];
        const outcome = await pinForm.save();
        if (outcome.kind === "failed") {
            if (pinNumberFailureStore.value?.kind === "too_main_failed_pin_attempts") {
                toastStore.showFailureToast(pinNumberErrorMessageStore);
            }
            throw new Error("pin not saved");
        }
    }
</script>

<WalletSettingsDialog
    tokens={walletCatalogue.tokens}
    {value}
    onChange={changed}
    onSetPin={(next) => pin({ kind: "set" }, undefined, next)}
    onChangePin={(current, next) => pin({ kind: "change" }, current, next)}
    onDisablePin={(current) => pin({ kind: "clear" }, current, undefined)}
    onCancel={onClose} />
