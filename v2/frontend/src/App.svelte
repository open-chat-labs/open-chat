<script lang="ts">
    import { onMount } from "svelte";

    import "./i18n/i18n";
    import { loadSavedTheme } from "./theme/themes";
    import { rtlStore } from "./stores/rtl";
    import { _ } from "svelte-i18n";
    import { identityService } from "./fsm/identity.machine";
    const { state, send } = identityService;
    import Router from "svelte-spa-router";
    import { routes } from "./routes";
    import Login from "./components/Login.svelte";
    import Register from "./components/register/Register.controller.svelte";
    import Loading from "./components/Loading.svelte";
    import UnexpectedError from "./components/unexpectedError/UnexpectedError.svelte";
    import SessionExpired from "./components/sessionExpired/SessionExpired.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { RegisterMachine } from "./fsm/register.machine";

    onMount(() => {
        loadSavedTheme();
        calculateHeight();
    });

    function calculateHeight() {
        // fix the issue with 100vh layouts in various mobile browsers
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    $: regMachine = $state.children.registerMachine as ActorRefFrom<RegisterMachine>;

    $: {
        // subscribe to the rtl store so that we can set the overall page direction at the right time
        document.dir = $rtlStore ? "rtl" : "ltr";
    }
</script>

{#if $state.matches("login") || $state.matches("logging_in")}
    <Login loading={$state.matches("logging_in")} on:login={() => send({ type: "LOGIN" })} />
{:else if $state.matches("register_user") && regMachine}
    <Register machine={regMachine} />
{:else if $state.matches("logged_in")}
    <Router {routes} />
{:else if $state.matches("unexpected_error")}
    <UnexpectedError error={$state.context.error} />
{:else if $state.matches("expired")}
    <SessionExpired on:login={() => send({ type: "ACKNOWLEDGE_EXPIRY" })} />
{:else}
    <Loading />
{/if}

<svelte:window on:resize={calculateHeight} />
