<svelte:options immutable={true} />

<script lang="ts">
    export let caption: string;
</script>

<p class="caption">{caption}</p>

<style type="text/scss">
    .caption:not(:empty) {
        margin-bottom: $sp3;
    }
</style>
