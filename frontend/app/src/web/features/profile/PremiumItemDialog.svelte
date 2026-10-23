<!-- Paying CHIT for a premium item (the profile background) before using it, as the old UI's
     PremiumItemPayment did (app/src/logic/premium). Once paid, the item is used from a button here:
     a click, so the browser still lets it open a file chooser, which it may not after the payment's
     round trip. -->
<script lang="ts">
    import { OpenChat, type PremiumItem } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { PremiumItemPayment } from "@src/logic/premium/premiumItemPayment.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        item: PremiumItem;
        // the user's CHIT balance
        balance: number;
        // what using the item is called (an i18n key), and doing it
        useLabel: string;
        onUse: () => void;
        onClose: () => void;
    }

    let { item, balance, useLabel, onUse, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const payment = $derived(new PremiumItemPayment(client, item, () => balance));
    let paid = $state(false);
    const amounts = $derived({
        price: payment.price.toLocaleString(),
        balance: balance.toLocaleString(),
    });

    async function pay() {
        const outcome = await payment.pay();
        if (outcome.kind === "paid") paid = true;
        else toastStore.showFailureToast(outcome.reason);
    }

    // a payment on its way can't be walked away from: its outcome has to be seen
    function close() {
        if (!payment.paying) onClose();
    }
</script>

<!-- TODO(design): no premium item payment in the design; GAPS.md -->
<DialogShell title={$_(payment.label.key)} width={440} height="auto" onClose={close}>
    <p class="text">
        {#if paid}
            {$_("premiumItem.paid")}
        {:else if payment.insufficient}
            {$_("premiumItem.insufficientChit", { values: amounts })}
        {:else}
            {$_("premiumItem.priceMessage", { values: amounts })}
        {/if}
    </p>
    <div class="actions">
        {#if paid}
            <Button label={$_(useLabel)} onClick={onUse} />
        {:else}
            {#if payment.paying}<Spinner />{/if}
            <Button
                label={$_("cancel")}
                variant="secondary"
                disabled={payment.paying}
                onClick={close} />
            <Button label={$_("premiumItem.pay")} disabled={!payment.canPay} onClick={pay} />
        {/if}
    </div>
</DialogShell>

<style>
    .text {
        margin: 0;
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-16);
    }
</style>
