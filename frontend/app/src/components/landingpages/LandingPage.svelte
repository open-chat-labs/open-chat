<script lang="ts">
    import Router from "svelte-spa-router";
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import NotFound from "../NotFound.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import { location } from "svelte-spa-router";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    function routes(_logout: () => Promise<void>): any {
        return {
            "/home": HomePage,
            "/features": FeaturesPage,
            "/roadmap": HomePage,
            "/whitepaper": HomePage,
            "/architecture": HomePage,
            "*": NotFound,
        };
    }
    function login() {
        dispatch("login");
    }

    function logout() {
        dispatch("logout");
    }
</script>

<Header on:login={login} on:logout={logout} />

<main class="main">
    <!-- TODO: this is a bit weird -->
    {#if $location === "/features"}
        <FeaturesPage />
    {:else}
        <Content>
            <Router
                routes={routes(() => {
                    console.log("logout");
                    return Promise.resolve();
                })} />
        </Content>
    {/if}
</main>

<style type="text/scss">
    .main {
        position: relative;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 0 auto;
        margin-top: toRem(80);
    }
</style>
