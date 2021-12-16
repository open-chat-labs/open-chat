<svelte:options immutable={true} />

<script lang="ts">
    export let caption: string;
    export let reply: boolean = false;
</script>

<p class="caption" class:reply>{caption}</p>

<style type="text/scss">
    .caption:not(:empty) {
        display: inline;

        &.reply {
            display: block;
        }
    }
</style>
