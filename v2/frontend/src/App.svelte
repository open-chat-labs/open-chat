<script lang="ts">
    import { onMount } from "svelte";

    import "./i18n/i18n";
    import { loadSavedTheme } from "./theme/themes";
    import { rtlStore } from "./stores/rtl";
    import { _ } from "svelte-i18n";
    import { identityService } from "./fsm/identity.machine";
    const { state, send } = identityService;
    // import Router from "svelte-spa-router";
    // import { routes } from "./routes";
    import Login from "./components/Login.svelte";
    import Register from "./components/Register.svelte";
    import ExpiredModal from "./components/ExpiredModal.svelte";
    import Overlay from "./components/Overlay.svelte";
    import Loading from "./components/Loading.svelte";
    import UnexpectedError from "./components/UnexpectedError.svelte";

    onMount(() => {
        loadSavedTheme();
        calculateHeight();
    });

    function calculateHeight() {
        // fix the issue with 100vh layouts in various mobile browsers
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    $: {
        // subscribe to the rtl store so that we can set the overall page direction at the right time
        document.dir = $rtlStore ? "rtl" : "ltr";
    }

    $: {
        console.log($state.value);
    }
</script>

{#if $state.matches("login") || $state.matches("logging_in")}
    <Login
        loading={$state.matches("logging_in")}
        on:login={() => send({ type: "LOGIN" })} />
{:else if $state.matches("register_user") || $state.matches("registering_user")}
    <Register />
{:else if $state.matches("logged_in")}
    <h1>We are logged in</h1>
    <!-- <Router {routes} /> -->
{:else if $state.matches("failure")}
    <UnexpectedError error={$state.context.error} />
{:else if $state.matches("expired")}
    <div />
{:else}
    <Loading />
{/if}

<Overlay active={$state.matches("expired")}>
    <ExpiredModal on:login={() => send({ type: "ACKNOWLEDGE_EXPIRY" })} />
</Overlay>

<svelte:window on:resize={calculateHeight} />
