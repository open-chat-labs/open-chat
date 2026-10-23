<!-- Paying CHIT for a premium item (the profile background) before using it, as the old UI's
     PremiumItemPayment did (app/src/logic/premium). -->
<script lang="ts">
    import { OpenChat, type PremiumItem } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { PremiumItemPayment } from "@src/logic/premium/premiumItemPayment.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        item: PremiumItem;
        // the user's CHIT balance
        balance: number;
        onPaid: () => void;
        onClose: () => void;
    }

    let { item, balance, onPaid, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const payment = $derived(new PremiumItemPayment(client, item, () => balance));
    const amounts = $derived({
        price: payment.price.toLocaleString(),
        balance: balance.toLocaleString(),
    });

    async function pay() {
        const outcome = await payment.pay();
        if (outcome.kind === "paid") onPaid();
        else toastStore.showFailureToast(outcome.reason);
    }
</script>

<!-- TODO(design): no premium item payment in the design; GAPS.md -->
<DialogShell title={$_(payment.label.key)} width={440} height="auto" {onClose}>
    <p class="text">
        {payment.insufficient
            ? $_("premiumItem.insufficientChit", { values: amounts })
            : $_("premiumItem.priceMessage", { values: amounts })}
    </p>
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        <Button label={$_("premiumItem.pay")} disabled={!payment.canPay} onClick={pay} />
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
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-16);
    }
</style>
