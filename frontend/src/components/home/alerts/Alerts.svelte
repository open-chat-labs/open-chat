<script lang="ts">
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
</script>

<h1 on:click={() => dispatch("close")}>Alerts</h1>

<style type="text/scss">
</style>
