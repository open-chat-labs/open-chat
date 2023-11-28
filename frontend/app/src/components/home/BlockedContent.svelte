<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<div class="blocked">
    {$_("messageBlocked")}
</div>

<style lang="scss">
    .blocked {
        @include font(light, italic, fs-80);
    }
</style>
