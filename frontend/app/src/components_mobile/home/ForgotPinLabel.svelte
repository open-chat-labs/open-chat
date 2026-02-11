<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        onForgot: () => void;
    }
    let { onForgot }: Props = $props();
</script>

<div class="forgot">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_missing_attribute -->
    <a role="button" tabindex="0" onclick={onForgot}>
        <Translatable resourceKey={i18nKey("pinNumber.forgotLabel")} />
    </a>
</div>

<style lang="scss">
    .forgot {
        width: 100%;
        text-align: center;
        @include font(light, normal, fs-80);
        margin: $sp3 0;
    }
</style>
