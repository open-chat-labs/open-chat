<script lang="ts">
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let me: boolean;
</script>

{#if me}
    <div class={"prize"}>
        <div class="spinner">
            <FancyLoader />
        </div>
        <p><Translatable resourceKey={i18nKey("prizes.creatingYourPrizeMessage")} /></p>
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
