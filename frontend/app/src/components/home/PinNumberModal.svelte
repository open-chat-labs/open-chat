<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Pincode from "../pincode/Pincode.svelte";

    const dispatch = createEventDispatcher();

    export let message: string | undefined = undefined;
    export let pin: string | undefined = undefined;

    let showError = false;

    function onPinComplete(ev: CustomEvent<{ code: string[]; value: string }>) {
        dispatch("complete", ev.detail.value);
    }

    function forgotPin() {
        dispatch("forgot");
    }
</script>

<ModalContent closeIcon hideFooter fixedWidth={false} on:close>
    <div slot="header">
        <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
    </div>
    <div class="body" slot="body">
        {#if message !== undefined}
            <p>
                <Translatable resourceKey={i18nKey(message)} />
            </p>
        {/if}
        <Pincode type="numeric" length={6} bind:value={pin} on:complete={onPinComplete} />
        <div class="forgot">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-missing-attribute -->
            <a role="button" tabindex="0" on:click={forgotPin}>
                <Translatable resourceKey={i18nKey("pinNumber.forgotLabel")} />
            </a>
        </div>
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
    .forgot {
        text-align: center;
        @include font(light, normal, fs-80);
        margin: $sp3 0;
    }
</style>
