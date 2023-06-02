<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<span class="placeholder">
    {$_("placeholderContent")}
</span>

<style lang="scss">
    .placeholder {
        padding: $sp4;
        @include font(light, italic, fs-90);
    }
</style>
