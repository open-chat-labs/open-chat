<script lang="ts">
    import { onMount, setContext } from "svelte";

    import "./i18n/i18n";
    import { loadAndApplySavedTheme } from "./theme/themes";
    import { rtlStore } from "./stores/rtl";
    import { _ } from "svelte-i18n";
    import Router from "svelte-spa-router";
    import { routes } from "./routes";
    import Login from "./components/Login.svelte";
    const Register = () => import("./components/register/Register.controller.svelte");
    import Upgrading from "./components/upgrading/Upgrading.svelte";
    import Loading from "./components/Loading.svelte";
    import SessionExpired from "./components/sessionExpired/SessionExpired.svelte";
    import Lazy from "./components/Lazy.svelte";
    import { IdentityController } from "./fsm/identity.controller";

    let controller: IdentityController = new IdentityController();
    setContext("identityController", controller);

    $: identityState = controller.state;

    onMount(() => {
        loadAndApplySavedTheme();
        calculateHeight();
        window.addEventListener("orientationchange", calculateHeight);
    });

    function calculateHeight() {
        // fix the issue with 100vh layouts in various mobile browsers
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    // $: regMachine = $state.children.registerMachine as ActorRefFrom<RegisterMachine>;

    $: {
        // subscribe to the rtl store so that we can set the overall page direction at the right time
        document.dir = $rtlStore ? "rtl" : "ltr";
    }
</script>

{#if $identityState === "requires_login" || $identityState === "logging_in"}
    <Login loading={$identityState === "logging_in"} on:login={() => controller.login()} />
{:else if $identityState === "registering" && controller.registerController !== undefined}
    <Lazy
        component={Register}
        identityController={controller}
        controller={controller.registerController} />
{:else if $identityState === "logged_in"}
    <Router {routes} />
{:else if $identityState == "expired"}
    <SessionExpired on:login={() => controller.acknowledgeExpiry()} />
{:else if $identityState === "upgrading_user" || $identityState === "upgrade_user"}
    <Upgrading />
{:else}
    <Loading />
{/if}

<svelte:window on:resize={calculateHeight} />
