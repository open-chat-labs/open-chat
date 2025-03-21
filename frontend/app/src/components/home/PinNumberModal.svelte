<script lang="ts">
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Pincode from "../pincode/Pincode.svelte";
    import ForgotPinLabel from "./ForgotPinLabel.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";

    interface Props {
        message?: string | undefined;
        pin?: string | undefined;
        onComplete: (pin: string) => void;
        onClose: () => void;
        onForgot: () => void;
    }

    let {
        message = undefined,
        pin = $bindable(undefined),
        onComplete,
        onClose,
        onForgot,
    }: Props = $props();

    function onPinComplete(ev: CustomEvent<{ code: string[]; value: string }>) {
        onComplete(ev.detail.value);
    }
</script>

<ModalContent closeIcon hideFooter fitToContent={!mobileWidth} fixedWidth={false} {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if message !== undefined}
                <p>
                    <Translatable resourceKey={i18nKey(message)} />
                </p>
            {/if}
            <Pincode type="numeric" length={6} bind:value={pin} on:complete={onPinComplete} />
            <ForgotPinLabel on:forgot={onForgot} />
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
        max-width: 500px;
    }
</style>
