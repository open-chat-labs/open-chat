<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { currentUserStore, PaidFeature, type ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "./Translatable.svelte";

    // The idea of this is that is can be wrapper around any thing that requires a payment
    // when we click the inner thing, we check that the user has paid for the thing. If they
    // have then the click can proceed, if they have not then they are prompted to pay for the
    // thing and only *then* can the click proceed

    type OnClick = () => void;

    const labels: Map<PaidFeature, ResourceKey> = new Map([
        [PaidFeature.CustomProfileBackground, i18nKey("Custom profile background")],
    ]);

    interface Props {
        onClick: OnClick;
        children: Snippet<[OnClick]>;
        feature: PaidFeature;
    }

    let { onClick, children, feature }: Props = $props();
    let showPayGate = $state(false);
    let paying = $state(false);
    let hasFeature = $derived($currentUserStore.paidFeatures.has(feature));

    let wrappedClick = $derived.by(() => {
        return () => {
            if (hasFeature) {
                return onClick();
            } else {
                showPayGate = true;
            }
        };
    });

    function pay() {
        // la la la - do the payment, update the currentuserstore etc
        // and then ...
        paying = true;
        window.setTimeout(() => {
            showPayGate = false;
            paying = false;
            onClick();
        }, 2000);
    }
</script>

{#if showPayGate}
    <Overlay>
        <ModalContent>
            {#snippet header()}
                <Translatable resourceKey={labels.get(feature) ?? i18nKey("Premium Feature")}
                ></Translatable>
            {/snippet}

            {#snippet body()}
                You need to pay X CHIT or Y CHAT for this feature.
            {/snippet}

            {#snippet footer()}
                <ButtonGroup>
                    <Button onClick={() => (showPayGate = false)} secondary>Cancel</Button>
                    <Button loading={paying} disabled={paying} onClick={pay}>Pay</Button>
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<div class="premium" class:locked={!hasFeature}>
    {@render children(wrappedClick)}
</div>

<style lang="scss">
    :global(.premium.locked *) {
        filter: blur(2px);
    }

    .premium {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .premium.locked::after {
        $size: $sp4;
        content: "";
        width: $size;
        height: $size;
        background-image: url("/assets/locked.svg");
        background-repeat: no-repeat;
        background-position: 50%;
        position: absolute;
        pointer-events: none;
    }
</style>
