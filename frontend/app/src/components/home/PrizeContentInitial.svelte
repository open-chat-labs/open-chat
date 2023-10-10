<script lang="ts">
    import { _ } from "svelte-i18n";
    import FancyLoader from "../icons/FancyLoader.svelte";

    export let me: boolean;
</script>

{#if me}
    <div class={"prize"}>
        <div class="spinner">
            <FancyLoader />
        </div>
        <p>{$_("prizes.creatingYourPrizeMessage")}</p>
    </div>
{/if}

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
