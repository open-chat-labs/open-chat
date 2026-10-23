<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        Body,
        Button,
        ColourVars,
        Container,
        Sheet,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import { currentUserStore, OpenChat, type PremiumItem } from "@client";
    import { getContext } from "svelte";
    import { PremiumItemPayment } from "@src/logic/premium/premiumItemPayment.svelte";
    import { _ } from "svelte-i18n";
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

<Sheet onDismiss={onCancel}>
    <Container gap={"lg"} direction={"vertical"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={payment.label}></Translatable>
        </Subtitle>
        {#if payment.insufficient}
            <StatusCard
                background={ColourVars.surface0}
                mode={"warning"}
                title={"Insufficient CHIT"}
                body={interpolate(
                    $_,
                    i18nKey("premiumItem.insufficientChit", {
                        price: payment.price.toLocaleString(),
                        balance: $currentUserStore.chitBalance.toLocaleString(),
                    }),
                )}>
            </StatusCard>
        {:else}
            <Container padding={["lg", "zero"]} gap={"md"}>
                <div class="icon"></div>
                <Body>
                    <Translatable
                        resourceKey={i18nKey("premiumItem.priceMessage", {
                            price: payment.price.toLocaleString(),
                            balance: $currentUserStore.chitBalance.toLocaleString(),
                        })}></Translatable>
                </Body>
            </Container>
        {/if}

        <Button loading={payment.paying} disabled={!payment.canPay} onClick={pay}>Pay</Button>
    </Container>
</Sheet>

<style lang="scss">
    .icon {
        background-image: url(/assets/chit.svg);
        background-repeat: no-repeat;
        background-position: 50%;
        width: toRem(48);
        height: toRem(48);
    }
</style>
