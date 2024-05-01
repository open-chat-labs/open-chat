<script lang="ts">
    import { getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";
    import { type OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: pinNumberStore = client.capturePinNumberStore;

    let showError = false;

    function onPinComplete(ev: CustomEvent<{ code: string[]; value: string }>) {
        if (!isPinComplete(ev.detail.code)) {
            return;
        }

        if (!isPinValid(ev.detail.code)) {
            showError = true;
            return;
        }

        $pinNumberStore?.resolve(ev.detail.value);
    }

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function isPinComplete(pin: string[]): boolean {
        return pin.filter((c) => c.length > 0).length === 6;
    }
</script>

<ModalContent hideFooter fitToContent fixedWidth={false}>
    <div slot="header">
        <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
    </div>
    <div class="body" slot="body">
        {#if $pinNumberStore?.message !== undefined}
            <p>
                <Translatable resourceKey={i18nKey($pinNumberStore.message)} />
            </p>
        {/if}
        <Pincode on:complete={onPinComplete}>
            <PincodeInput />
            <PincodeInput />
            <PincodeInput />
            <PincodeInput />
            <PincodeInput />
            <PincodeInput />
        </Pincode>
        {#if showError}
            <div class="error">
                <Translatable resourceKey={i18nKey("pinNumber.invalid")} />
            </div>
        {/if}
    </div>
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
