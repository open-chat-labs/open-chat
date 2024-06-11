<script lang="ts">
    import Home from "./Home.svelte";
    import { getContext } from "svelte";
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import LandingPage from "../landingpages/LandingPage.svelte";

    export let showLandingPage: boolean;
    export let joinAfterRegister:
        | CustomEvent<{ group: MultiUserChat; select: boolean }>
        | undefined = undefined;

    const client = getContext<OpenChat>("client");
    $: identityState = client.identityState;
    $: chatsLoading = client.chatsLoading;
    $: showLoader =
        $identityState.kind !== "registering" &&
        ($chatsLoading || $identityState.kind === "loading_user");
</script>

{#if showLandingPage}
    <LandingPage />
{:else if showLoader}
    <div class="loading">
        <div class="inner-loader">
            <FancyLoader />
        </div>
    </div>
{:else}
    <Home bind:joinAfterRegister on:startVideoCall on:askToSpeak on:hangup />
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
