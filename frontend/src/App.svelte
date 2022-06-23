<script lang="ts">
    import { onMount } from "svelte";

    import "./i18n/i18n";
    import { rtlStore } from "./stores/rtl";
    import { _ } from "svelte-i18n";
    import Router from "svelte-spa-router";
    import { routes } from "./routes";
    import Login from "./components/Login.svelte";
    import Register from "./components/register/Register.svelte";
    import Upgrading from "./components/upgrading/Upgrading.svelte";
    import Loading from "./components/Loading.svelte";
    import SessionExpired from "./components/sessionExpired/SessionExpired.svelte";
    import { SessionExpiryError } from "./services/httpError";
    import UpgradeBanner from "./components/UpgradeBanner.svelte";
    import { mobileOperatingSystem } from "./utils/devices";

    import "./theme/themes";
    import "./stores/fontSize";
    import { showTrace } from "./services/common/profiling";
    import Profiler from "./components/Profiler.svelte";
    import { writable } from "svelte/store";
    import type { Identity } from "@dfinity/agent";
    import { ServiceContainer } from "./services/serviceContainer";
    import type { CreatedUser } from "./domain/user/user";
    import { Poller } from "./fsm/poller";
    import { getIdentity, login, logout, startSession } from "./services/auth";
    import { clearSelectedChat, currentUserStore, startChatPoller } from "./stores/chat";
    import { apiStore } from "./stores/api";
    import { rtcConnectionsManager } from "./domain/webrtc/RtcConnectionsManager";
    import { startUserUpdatePoller } from "./stores/user";
    import { IMessageReadTracker, MessageReadTracker } from "./stores/markRead";

    const UPGRADE_POLL_INTERVAL = 1000;
    const MARK_ONLINE_INTERVAL = 61 * 1000;
    type IdentityState =
        | "requires_login"
        | "loading_user"
        | "logged_in"
        | "registering"
        | "logging_in"
        | "upgrading_user"
        | "upgrade_user"
        | "expired";

    let viewPortContent = "width=device-width, initial-scale=1";
    let profileTrace = showTrace();

    let identityState = writable<IdentityState>("requires_login");
    let identity: Identity;
    let api: ServiceContainer;
    let markOnlinePoller: Poller | undefined;
    let chatPoller: Poller | undefined;
    let usersPoller: Poller | undefined;
    let referredBy: string | undefined = undefined;
    let messagesRead: IMessageReadTracker;

    onMount(() => {
        referredBy = new URLSearchParams(window.location.search).get("ref") ?? undefined;
        if (referredBy !== undefined) {
            history.replaceState(null, "", "/#/");
        }

        if (mobileOperatingSystem === "iOS") {
            viewPortContent += ", maximum-scale=1";
        }
        calculateHeight();
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);

        getIdentity().then((id) => loadedIdentity(id));
    });

    function loadedIdentity(id: Identity) {
        identity = id;
        const anon = id.getPrincipal().isAnonymous();
        identityState.set(anon ? "requires_login" : "loading_user");
        if (!anon) {
            loadUser(id);
        }
    }

    function loadUser(id: Identity) {
        if (api === undefined || api.differentIdentity(id)) {
            api = new ServiceContainer(id);
        }
        api.getCurrentUser().then((user) => {
            switch (user.kind) {
                case "unknown_user":
                    identityState.set("registering");
                    break;
                case "created_user":
                    onCreatedUser(id, user);
                    break;
            }
        });
    }

    function registeredUser(ev: CustomEvent<CreatedUser>) {
        onCreatedUser(identity, ev.detail);
    }

    function onCreatedUser(id: Identity, user: CreatedUser): void {
        if (user.canisterUpgradeStatus === "in_progress") {
            identityState.set("upgrading_user");
            window.setTimeout(() => loadUser(id), UPGRADE_POLL_INTERVAL);
        } else {
            identityState.set("logged_in");
            api?.createUserClient(user.userId);
            currentUserStore.set(user);
            apiStore.set(api);
            messagesRead = new MessageReadTracker(api!);
            startOnlinePoller();
            startSession(id).then(() => endSession());
            chatPoller = startChatPoller(api!, messagesRead);
            usersPoller = startUserUpdatePoller(api);
            api.getUserStorageLimits();
        }
    }

    function endSession(): void {
        performLogout().then(() => identityState.set("expired"));
    }

    function performLogout(): Promise<void> {
        console.log("logging out");
        return logout().then(() => {
            identityState.set("requires_login");
            currentUserStore.set(undefined);
            apiStore.set(undefined);
            messagesRead?.stop();
            chatPoller?.stop();
            usersPoller?.stop();
            markOnlinePoller?.stop();
            clearSelectedChat();
            return;
        });
    }

    function startOnlinePoller() {
        api?.markAsOnline();
        markOnlinePoller = new Poller(
            () => api?.markAsOnline() ?? Promise.resolve(),
            MARK_ONLINE_INTERVAL
        );
    }

    function doLogin(): void {
        identityState.set("logging_in");
        login().then((id) => loadedIdentity(id));
    }

    function acknowledgeExpiry(): void {
        doLogin();
    }

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
            endSession();
            ev.preventDefault();
        }
    }
</script>

<svelte:head>
    <meta name="viewport" content={viewPortContent} />
</svelte:head>

{#if $identityState === "requires_login" || $identityState === "logging_in"}
    <Login loading={$identityState === "logging_in"} on:login={() => doLogin()} />
{:else if $identityState === "registering"}
    <Register on:logout={performLogout} on:createdUser={registeredUser} {api} {referredBy} />
{:else if $identityState === "logged_in"}
    <Router routes={routes(messagesRead, performLogout)} />
{:else if $identityState == "expired"}
    <SessionExpired on:login={() => acknowledgeExpiry()} />
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
