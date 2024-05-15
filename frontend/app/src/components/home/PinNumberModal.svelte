<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";

    const dispatch = createEventDispatcher();

    export let message: string | undefined = undefined;
    export let pin: string | undefined = undefined;

    let showError = false;

    function onPinComplete(ev: CustomEvent<{ code: string[]; value: string }>) {
        if (!isPinComplete(ev.detail.code)) {
            return;
        }

        if (!isPinValid(ev.detail.code)) {
            showError = true;
            return;
        }

        dispatch("complete", ev.detail.value);
    }

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function isPinComplete(pin: string[]): boolean {
        return pin.filter((c) => c.length > 0).length === 6;
    }
</script>

<ModalContent closeIcon hideFooter fitToContent fixedWidth={false} on:close>
    <div slot="header">
        <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
    </div>
    <div class="body" slot="body">
        {#if message !== undefined}
            <p>
                <Translatable resourceKey={i18nKey(message)} />
            </p>
        {/if}
        <Pincode bind:value={pin} on:complete={onPinComplete}>
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
