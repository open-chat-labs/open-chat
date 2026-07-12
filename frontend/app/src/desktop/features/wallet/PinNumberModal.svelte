<script lang="ts">
    import { mobileWidth } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Pincode from "@src/desktop/features/pincode/Pincode.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import ForgotPinLabel from "@src/desktop/shared/ForgotPinLabel.svelte";

    interface Props {
        onComplete: (pin: string) => void;
        onClose: () => void;
        onForgot: () => void;
    }

    let { onComplete, onClose, onForgot }: Props = $props();

    function onPinComplete(_: string[], value: string) {
        onComplete(value);
    }
</script>

<ModalContent closeIcon hideFooter fitToContent={!$mobileWidth} fixedWidth={false} {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
    {/snippet}
    {#snippet body()}
        <div class="body">
            <Pincode type="numeric" length={6} onComplete={onPinComplete} />
            <ForgotPinLabel {onForgot} />
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
