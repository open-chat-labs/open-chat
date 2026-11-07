<!-- Paying CHIT for a profile cover before the first one (Edit profile's Cover), as the web's
     PremiumItemDialog and the old UI's PremiumItemPayment (logic/premium): the price against the
     balance, Pay, and once paid, Choose image, a tap of its own so the OS still lets it open the
     picker after the payment's round trip. A payment on its way can't be walked away from. -->
<script lang="ts">
    import { chitStateStore, PremiumItem, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { PremiumItemPayment } from "@src/logic/premium/premiumItemPayment.svelte";
    import { getContext } from "svelte";
    import { _, locale } from "svelte-i18n";

    type Props = {
        open: boolean;
        /** Paid: the picker opens from this tap. */
        onChoose: () => void;
        /** Why paying failed, translated. */
        onFailed: (reason: string) => void;
        onClose: () => void;
    };

    let { open, onChoose, onFailed, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const payment = new PremiumItemPayment(
        client,
        PremiumItem.CustomProfileBackground,
        () => $chitStateStore.chitBalance,
    );
    let paid = $state(false);

    const amounts = $derived({
        price: payment.price.toLocaleString($locale ?? "en"),
        balance: payment.balance.toLocaleString($locale ?? "en"),
    });

    async function pay() {
        const outcome = await payment.pay();
        if (outcome.kind === "paid") paid = true;
        else onFailed(interpolate($_, outcome.reason));
    }

    function close() {
        if (!payment.paying) onClose();
    }
</script>

<BottomSheet {open} onClose={close} title={$_("premiumItem.customProfileBackground")}>
    <div class="body">
        <p class="text">
            {#if paid}
                {$_("premiumItem.paid")}
            {:else if payment.insufficient}
                {$_("premiumItem.insufficientChit", { values: amounts })}
            {:else}
                {$_("premiumItem.priceMessage", { values: amounts })}
            {/if}
        </p>
        {#if paid}
            <Button label={$_("chooseImage")} size="lg" fullWidth onClick={onChoose} />
        {:else}
            <Button
                label={$_("premiumItem.pay")}
                icon="zap"
                size="lg"
                fullWidth
                disabled={!payment.canPay}
                onClick={() => void pay()} />
        {/if}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .text {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
    }
</style>
