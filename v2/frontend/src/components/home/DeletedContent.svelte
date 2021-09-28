<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<span class="deleted">
    {$_("messageDeleted")}
</span>

<style type="text/scss">
    .deleted {
        @include font(light, italic, fs-90);
    }
</style>
