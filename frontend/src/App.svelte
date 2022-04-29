<script lang="ts">
    import { onMount, setContext } from "svelte";

    import "./i18n/i18n";
    import { rtlStore } from "./stores/rtl";
    import { _ } from "svelte-i18n";
    import Router from "svelte-spa-router";
    import { routes } from "./routes";
    import Login from "./components/Login.svelte";
    const Register = () => import("./components/register/Register.svelte");
    import Upgrading from "./components/upgrading/Upgrading.svelte";
    import Loading from "./components/Loading.svelte";
    import SessionExpired from "./components/sessionExpired/SessionExpired.svelte";
    import Lazy from "./components/Lazy.svelte";
    import { IdentityController } from "./fsm/identity.controller";
    import { SessionExpiryError } from "./services/httpError";
    import UpgradeBanner from "./components/UpgradeBanner.svelte";
    import { mobileOperatingSystem } from "./utils/devices";

    import "./theme/themes";
    import "./stores/fontSize";
    import { showTrace } from "./services/common/profiling";
    import Profiler from "./components/Profiler.svelte";

    let viewPortContent = "width=device-width, initial-scale=1";
    let controller: IdentityController = new IdentityController();
    let profileTrace = showTrace();
    setContext("identityController", controller);

    $: identityState = controller.state;

    onMount(() => {
        if (mobileOperatingSystem === "iOS") {
            viewPortContent += ", maximum-scale=1";
        }
        calculateHeight();
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
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

    function unhandledError(ev: Event) {
        if (ev instanceof PromiseRejectionEvent && ev.reason instanceof SessionExpiryError) {
            controller.endSession();
            ev.preventDefault();
        }
    }
</script>

<svelte:head>
    <meta name="viewport" content={viewPortContent} />
</svelte:head>

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

{#if profileTrace}
    <Profiler />
{/if}

<UpgradeBanner />

<svelte:window on:resize={calculateHeight} on:error={unhandledError} />
