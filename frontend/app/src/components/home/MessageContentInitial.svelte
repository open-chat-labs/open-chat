<script lang="ts">
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Translatable from "../Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    export let text: ResourceKey;
    export let failed: boolean;
</script>

<div class={"prize"}>
    {#if !failed}
        <div class="spinner">
            <FancyLoader />
        </div>
    {/if}
    <p><Translatable resourceKey={text} /></p>
</div>

<style lang="scss">
    .prize {
        padding: $sp5;
        display: flex;
        flex-direction: column;
        gap: $sp6;
    }
    .spinner {
        width: 100px;
        margin: 0 auto;
    }
</style>
