<svelte:options immutable />

<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
</script>

<span class="placeholder">
    <Translatable resourceKey={i18nKey("placeholderContent")} />
</span>

<style lang="scss">
    .placeholder {
        padding: $sp4;
        @include font(light, italic, fs-90);
    }
</style>
