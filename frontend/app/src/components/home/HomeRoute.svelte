<script lang="ts">
    import Home from "./Home.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";

    const client = getContext<OpenChat>("client");
    $: identityState = client.identityState;
    $: chatsLoading = client.chatsLoading;
</script>

{#if $identityState.kind === "loading_user" || $chatsLoading}
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
