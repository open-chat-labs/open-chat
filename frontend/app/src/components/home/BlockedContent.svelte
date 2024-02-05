<svelte:options immutable />

<script lang="ts">
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
</script>

<div class="blocked">
    <Translatable resourceKey={i18nKey("messageBlocked")} />
</div>

<style lang="scss">
    .blocked {
        @include font(light, italic, fs-80);
    }
</style>
