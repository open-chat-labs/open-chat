<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { currentUserStore, OpenChat, type PremiumItem } from "@client";
    import { getContext } from "svelte";
    import { PremiumItemPayment } from "@src/logic/premium/premiumItemPayment.svelte";
    import AlertBox from "./AlertBox.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        item: PremiumItem;
        onSuccess: () => void;
        onCancel: () => void;
    }

    let { item, onSuccess, onCancel }: Props = $props();
    // its price against the user's CHIT, and the payment (app/src/logic/premium)
    let payment = $derived(
        new PremiumItemPayment(client, item, () => $currentUserStore.chitBalance),
    );

    async function pay() {
        const outcome = await payment.pay();
        if (outcome.kind === "paid") onSuccess();
        else toastStore.showFailureToast(outcome.reason);
    }
</script>

<Overlay>
    <ModalContent>
        {#snippet header()}
            <Translatable resourceKey={payment.label}></Translatable>
        {/snippet}

        {#snippet body()}
            <div class="body">
                {#if payment.insufficient}
                    <AlertBox>
                        <Translatable
                            resourceKey={i18nKey("premiumItem.insufficientChit", {
                                price: payment.price.toLocaleString(),
                                balance: $currentUserStore.chitBalance.toLocaleString(),
                            })}></Translatable>
                    </AlertBox>
                {:else}
                    <div class="message">
                        <div class="icon"></div>
                        <Translatable
                            resourceKey={i18nKey("premiumItem.priceMessage", {
                                price: payment.price.toLocaleString(),
                                balance: $currentUserStore.chitBalance.toLocaleString(),
                            })}></Translatable>
                    </div>
                {/if}
            </div>
        {/snippet}

        {#snippet footer()}
            <ButtonGroup>
                <Button onClick={onCancel} secondary>Cancel</Button>
                <Button loading={payment.paying} disabled={!payment.canPay} onClick={pay}
                    >Pay</Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .message {
        display: flex;
        gap: $sp4;
        align-items: flex-start;

        .icon {
            background-image: url(/assets/chit.svg);
            background-repeat: no-repeat;
            background-position: 50%;
            width: toRem(48);
            height: toRem(48);
        }
    }
</style>
