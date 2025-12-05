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
    import {
        currentUserStore,
        OpenChat,
        PremiumItem,
        premiumPrices,
        type ResourceKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    const labels: Record<PremiumItem, ResourceKey> = {
        [PremiumItem.BotEmojis]: i18nKey("premiumItem.botEmojis"),
        [PremiumItem.PopularEmojis]: i18nKey("premiumItem.popularEmojis"),
        [PremiumItem.CustomProfileBackground]: i18nKey("premiumItem.customProfileBackground"),
    };

    interface Props {
        item: PremiumItem;
        onSuccess: () => void;
        onCancel: () => void;
    }

    let { item, onSuccess, onCancel }: Props = $props();
    let paying = $state(false);
    let price = $derived(premiumPrices[item]);
    let insufficient = $derived($currentUserStore.chitBalance < price);

    function pay() {
        paying = true;
        client
            .payForPremiumItem(item)
            .then((resp) => {
                if (resp.kind === "success") {
                    onSuccess();
                } else {
                    toastStore.showFailureToast(i18nKey("premiumItem.paymentFailure"));
                }
            })
            .finally(() => (paying = false));
    }
</script>

<Sheet onDismiss={onCancel}>
    <Container gap={"lg"} direction={"vertical"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={labels[item] ?? i18nKey("premiumItem.title")}></Translatable>
        </Subtitle>
        {#if insufficient}
            <StatusCard
                background={ColourVars.background0}
                mode={"warning"}
                title={"Insufficient CHIT"}
                body={interpolate(
                    $_,
                    i18nKey("premiumItem.insufficientChit", {
                        price: premiumPrices[item].toLocaleString(),
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
                            price: premiumPrices[item].toLocaleString(),
                            balance: $currentUserStore.chitBalance.toLocaleString(),
                        })}></Translatable>
                </Body>
            </Container>
        {/if}

        <Button loading={paying} disabled={paying || insufficient} onClick={pay}>Pay</Button>
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
