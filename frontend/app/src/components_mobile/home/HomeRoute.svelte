<script lang="ts">
    import { chatsInitialisedStore, identityStateStore } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Home from "./Home.svelte";

    let registering = $derived(
        $identityStateStore.kind === "registering" ||
            $identityStateStore.kind === "challenging" ||
            ($identityStateStore.kind === "loading_user" && $identityStateStore.registering),
    );

    let showLoader = $derived(
        !registering && (!$chatsInitialisedStore || $identityStateStore.kind === "loading_user"),
    );
</script>

{#if showLoader}
    <div class="loading">
        <div class="inner-loader">
            <FancyLoader />
        </div>
    </div>
{:else}
    <Home />
{/if}

<style lang="scss">
    .loading {
        width: 100vw;
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);
        height: 100dvh; // firefox will ignore this
        display: grid;
    }

    .inner-loader {
        width: toRem(48);
        height: toRem(48);
        margin: auto;
    }
</style>
