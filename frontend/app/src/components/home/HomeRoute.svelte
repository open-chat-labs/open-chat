<script lang="ts">
    import Home from "./Home.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Loading from "../Loading.svelte";
    import LandingPage from "../landingpages/LandingPage.svelte";

    const client = getContext<OpenChat>("client");
    $: identityState = client.identityState;
    $: landingPage =
        $identityState === "requires_login" ||
        $identityState === "registering" ||
        $identityState === "dismissed_registering" ||
        $identityState === "logging_in";
</script>

{#if landingPage}
    <LandingPage />
{:else if $identityState === "loading_user"}
    <div class="loading">
        <Loading />
    </div>
{:else}
    <Home />
{/if}

<style type="text/scss">
    .loading {
        height: 100vh;
        width: 100vw;
    }
</style>
