<!-- The composer's "+" → Swap crypto (5d): SwapOfferDialog, for Diamond members only (the "+" menu
     opens the Diamond dialog for anyone else, as the old builders did). An offer is confirmed
     first, as the mobile app confirms it (it locks the user's funds for up to 90 days): the
     confirmation takes the builder's place over the same backdrop, its back arrow returning to the
     offer as it was filled in, × or the backdrop closing both. Once confirmed it's attached to the
     chat's draft and funded when the message is sent, with the PIN asked for then. What it costs
     is `swapOfferCosts`' (the deposit's two fees and the approval's), through the dialog's
     `depositFees`; SwapOfferForm (logic/wallet) reads and checks what was typed. Opened again from
     the composer's chip, it edits the staged offer. Pays from the OpenChat wallet only (GAPS: no
     external wallet picker).
     TODO(design): the design has no confirmation for an offer; DialogShell with the old one's
     words. -->
<script lang="ts">
    import {
        cryptoBalanceStore,
        cryptoLookup,
        cryptoTokensSorted,
        exchangeRatesLookupStore,
        i18nKey,
        isDiamondStore,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        publish,
        type CryptocurrencyDetails,
        type TokenInfo,
    } from "@client";
    import SwapOfferDialog from "@openchat/ui/src/features/components/SwapOfferDialog.svelte";
    import type { CryptoToken } from "@openchat/ui/src/features/components/SendCryptoDialog.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import type { SwapOffer } from "@openchat/ui/src/lib/types";
    import { interpolate } from "@src/i18n/i18n";
    import { SwapOfferForm } from "@src/logic/wallet/swapOfferForm.svelte";
    import { toastStore } from "@src/stores/toast";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { builderTokens, composerSwapOffer, swapDepositFees } from "./builders.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "swap_offer" }>> = $props();

    const form = new SwapOfferForm<SwapOffer>();
    const editing = untrack(() => dialog.editing);
    const first = editing?.token0.ledger ?? lastCryptoSent.value ?? LEDGER_CANISTER_ICP;

    // every token: one to offer must be held (the dialog's picker says so), any can be asked for
    const tokens = $derived(builderTokens($cryptoTokensSorted, $exchangeRatesLookupStore, first));

    function details(symbol: string): CryptocurrencyDetails | undefined {
        const ledger = tokens.find((t) => t.token.symbol === symbol)?.ledger;
        return ledger === undefined ? undefined : $cryptoLookup.get(ledger);
    }

    function tokenInfo(token: CryptocurrencyDetails): TokenInfo {
        return {
            ledger: token.ledger,
            symbol: token.symbol,
            decimals: token.decimals,
            fee: token.transferFee,
        };
    }

    const initial = $derived.by((): SwapOffer | null => {
        if (editing === undefined) return null;
        const give = $cryptoLookup.get(editing.token0.ledger);
        const get = $cryptoLookup.get(editing.token1.ledger);
        if (give === undefined || get === undefined) return null;
        return composerSwapOffer(
            editing,
            give,
            get,
            {
                give: $exchangeRatesLookupStore.get(give.ledger)?.toUSD,
                get: $exchangeRatesLookupStore.get(get.ledger)?.toUSD,
            },
            (key, values) => $_(key, { values }),
        );
    });

    function depositFees(token: CryptoToken): number {
        const facts = details(token.symbol);
        return facts === undefined ? 0 : swapDepositFees(facts);
    }

    function review(offer: SwapOffer) {
        const give = details(offer.draft.give);
        const get = details(offer.draft.get);
        const step =
            give === undefined || get === undefined
                ? "invalid"
                : form.review(
                      {
                          give: tokenInfo(give),
                          get: tokenInfo(get),
                          balance: $cryptoBalanceStore.get(give.ledger) ?? 0n,
                          amountText: offer.draft.amt,
                          wantText: offer.draft.want,
                          expiresInMs: offer.expiresInMs,
                      },
                      $isDiamondStore,
                      offer,
                  );
        switch (step) {
            case "upgrade":
                // no longer a Diamond member: only they can make an offer
                onClose();
                publish("upgrade");
                break;
            case "invalid":
                toastStore.showFailureToast(i18nKey("builders.paymentRefused"));
                break;
        }
    }

    function confirm() {
        if (form.confirm({ chatId: dialog.chatId })) onClose();
    }
</script>

<!-- kept while the confirmation shows, so going back finds the offer as it was filled in; kept
     laid out too (hidden, not taken out), so its veil and card don't play their entrance again -->
<div class="offer" class:hidden={form.stage.kind === "confirming"}>
    <SwapOfferDialog
        tokens={tokens.map((t) => t.token)}
        {initial}
        {depositFees}
        onAttach={review}
        {onClose} />
</div>
{#if form.stage.kind === "confirming"}
    <!-- the backdrop is already showing: only the card comes in -->
    <div class="handoff">
        <DialogShell
            title={$_("p2pSwap.builderTitle")}
            width={440}
            height="auto"
            onBack={() => form.back()}
            {onClose}>
            <p class="message">{interpolate($_, form.stage.confirmation)}</p>
            <div class="actions">
                <Button label="ui.swapOfferDialog.attach" onClick={confirm} />
            </div>
        </DialogShell>
    </div>
{/if}

<style lang="scss">
    .offer,
    .handoff {
        display: contents;
    }

    .offer.hidden {
        visibility: hidden;
    }

    .handoff > :global(.layer > .scrim) {
        animation: none;
    }

    .message {
        margin: 0 0 var(--space-16);
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
