<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        currentUserStore,
        OpenChat,
        PremiumItem,
        premiumPrices,
        type ResourceKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
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

<Overlay>
    <ModalContent>
        {#snippet header()}
            <Translatable resourceKey={labels[item] ?? i18nKey("premiumItem.title")}></Translatable>
        {/snippet}

        {#snippet body()}
            <div class="body">
                <div class="icon"></div>
                <div class="message">
                    {#if insufficient}
                        <Translatable
                            resourceKey={i18nKey("premiumItem.insufficientChit", {
                                price: premiumPrices[item].toLocaleString(),
                                balance: $currentUserStore.chitBalance.toLocaleString(),
                            })}></Translatable>
                    {:else}
                        <Translatable
                            resourceKey={i18nKey("premiumItem.priceMessage", {
                                price: premiumPrices[item].toLocaleString(),
                                balance: $currentUserStore.chitBalance.toLocaleString(),
                            })}></Translatable>
                    {/if}
                </div>
            </div>
        {/snippet}

        {#snippet footer()}
            <ButtonGroup>
                <Button onClick={onCancel} secondary>Cancel</Button>
                <Button loading={paying} disabled={paying || insufficient} onClick={pay}
                    >Pay</Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
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
