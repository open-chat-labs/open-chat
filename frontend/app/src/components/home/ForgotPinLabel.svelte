<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const dispatch = createEventDispatcher();

    function forgotPin() {
        dispatch("forgot");
    }
</script>

<div class="forgot">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-missing-attribute -->
    <a role="button" tabindex="0" on:click={forgotPin}>
        <Translatable resourceKey={i18nKey("pinNumber.forgotLabel")} />
    </a>
</div>

<style lang="scss">
    .forgot {
        text-align: center;
        @include font(light, normal, fs-80);
        margin: $sp3 0;
    }
</style>
