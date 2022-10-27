<script lang="ts">
    import { onMount, setContext } from "svelte";

    import "../i18n/i18n";
    import "../utils/markdown";
    import { rtlStore } from "../stores/rtl";
    import { _ } from "svelte-i18n";
    import Router from "svelte-spa-router";
    import { routes } from "../routes";
    import Login from "./Login.svelte";
    import SwitchDomain from "./SwitchDomain.svelte";
    import Register from "./register/Register.svelte";
    import Upgrading from "./upgrading/Upgrading.svelte";
    import Loading from "./Loading.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import { mobileOperatingSystem } from "../utils/devices";
    import "../theme/themes";
    import "../stores/fontSize";
    import Profiler from "./Profiler.svelte";
    import { CreatedUser, OpenChat, SessionExpiryError } from "openchat-client";
    import { isCanisterUrl } from "../utils/urls";
    import { logger } from "../utils/logging";

    let viewPortContent = "width=device-width, initial-scale=1";
    let referredBy: string | undefined = undefined;

    function createOpenChatClient(): OpenChat {
        return new OpenChat({
            icUrl: process.env.IC_URL,
            iiDerivationOrigin: process.env.II_DERIVATION_ORIGIN,
            openStorageIndexCanister: process.env.OPEN_STORAGE_INDEX_CANISTER!,
            groupIndexCanister: process.env.GROUP_INDEX_CANISTER!,
            notificationsCanister: process.env.NOTIFICATIONS_CANISTER!,
            onlineCanister: process.env.ONLINE_CANISTER!,
            userIndexCanister: process.env.USER_INDEX_CANISTER!,
            internetIdentityUrl: process.env.INTERNET_IDENTITY_URL!,
            nfidUrl: process.env.NFID_URL!,
            ledgerCanisterICP: process.env.LEDGER_CANISTER_ICP!,
            ledgerCanisterBTC: process.env.LEDGER_CANISTER_BTC!,
            ledgerCanisterCHAT: process.env.LEDGER_CANISTER_CHAT!,
            userGeekApiKey: process.env.USERGEEK_APIKEY!,
            enableMultiCrypto: Boolean(process.env.ENABLE_MULTI_CRYPTO),
            blobUrlPattern: process.env.BLOB_URL_PATTERN!,
            proposalBotCanister: process.env.PROPOSALS_BOT_CANISTER!,
            i18nFormatter: $_,
            logger: logger,
        });
    }

    let client: OpenChat = createOpenChatClient();

    let profileTrace = client.showTrace();

    setContext<OpenChat>("client", client);

    $: identityState = client.identityState;

    function getReferralCode(): string | undefined {
        const qsParam = new URLSearchParams(window.location.search).get("ref") ?? undefined;
        const lsParam = localStorage.getItem("openchat_referredby") ?? undefined;
        return qsParam ?? lsParam;
    }

    onMount(() => {
        referredBy = getReferralCode();
        if (mobileOperatingSystem === "iOS") {
            viewPortContent += ", maximum-scale=1";
        }
        calculateHeight();
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
    });

    function registeredUser(ev: CustomEvent<CreatedUser>) {
        client.onCreatedUser(ev.detail);
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
        console.trace("Unhandled error: ", ev);
        if (ev instanceof PromiseRejectionEvent && ev.reason instanceof SessionExpiryError) {
            client.logout();
            ev.preventDefault();
        }
    }

    const allRoutes = routes(() => client.logout());
</script>

<svelte:head>
    <meta name="viewport" content={viewPortContent} />
</svelte:head>

{#if isCanisterUrl}
    <SwitchDomain />
{:else if $identityState === "requires_login" || $identityState === "logging_in"}
    <Login loading={$identityState === "logging_in"} on:login={() => client.login()} />
{:else if $identityState === "registering"}
    <Register on:logout={() => client.logout()} on:createdUser={registeredUser} {referredBy} />
{:else if $identityState === "logged_in"}
    <Router routes={allRoutes} />
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

<style type="text/scss">
    :global {
        html,
        body,
        div,
        span,
        object,
        iframe,
        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        p,
        blockquote,
        pre,
        abbr,
        address,
        cite,
        code,
        del,
        dfn,
        em,
        img,
        ins,
        kbd,
        q,
        samp,
        small,
        strong,
        sub,
        sup,
        var,
        b,
        i,
        dl,
        dt,
        dd,
        ol,
        ul,
        li,
        fieldset,
        form,
        label,
        legend,
        table,
        caption,
        tbody,
        tfoot,
        thead,
        tr,
        th,
        td,
        article,
        aside,
        canvas,
        details,
        figcaption,
        figure,
        footer,
        header,
        hgroup,
        menu,
        nav,
        section,
        summary,
        time,
        mark,
        audio,
        video {
            margin: 0;
            outline: 0;
            border: 0;
            background: transparent;
            padding: 0;
            vertical-align: baseline;
            font-size: 100%;
        }

        article,
        aside,
        details,
        figcaption,
        figure,
        footer,
        header,
        hgroup,
        menu,
        nav,
        section {
            display: block;
        }

        nav ul {
            list-style: none;
        }

        blockquote,
        q {
            quotes: none;
        }

        blockquote::before,
        blockquote::after,
        q::before,
        q::after {
            content: "";
        }

        a {
            margin: 0;
            background: transparent;
            cursor: pointer;
            padding: 0;
            vertical-align: baseline;
            text-decoration: none;
            color: inherit;
            font-size: inherit;
        }

        ins {
            background-color: none;
            text-decoration: none;
            color: currentColor;
        }

        mark {
            background-color: none;
            color: inherit;
            font-weight: bold;
        }

        del {
            text-decoration: line-through;
        }

        abbr[title],
        dfn[title] {
            border: none;
            cursor: help;
        }

        table {
            border-collapse: collapse;
            border-spacing: 0;
        }

        hr {
            display: block;
            margin: 0;
            border: 0;
            border-top: 1px solid currentColor;
            padding: 0;
            height: 1px;
        }

        input,
        select {
            vertical-align: middle;
        }

        html,
        body {
            position: relative;
            width: 100%;
            height: 100%;
        }

        :root {
            --font-size: 16px;
        }

        html {
            box-sizing: border-box;
            font-size: var(--font-size);
        }
        *,
        *:before,
        *:after {
            box-sizing: inherit;
        }

        :root {
            --bg: #121212;
        }

        body {
            transition: background ease-in-out 300ms, color ease-in-out 150ms,
                padding ease-in-out 150ms;
            padding: $sp4;
            background: var(--bg);
            color: var(--txt);
            margin: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu,
                Cantarell, "Helvetica Neue", sans-serif;
            display: flex;
            height: 100vh;
            height: calc(var(--vh, 1vh) * 100);

            @include size-below(lg) {
                padding: $sp3;
            }

            @include mobile() {
                padding: 0;
            }

            &.fill {
                transition: none;
                padding: 0;
            }
        }

        textarea {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu,
                Cantarell, "Helvetica Neue", sans-serif;
        }

        a {
            color: #22a7f2;
        }

        .iti__flag {
            background-image: url("assets/flags.png") !important;
        }

        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
            .iti__flag {
                background-image: url("assets/flags@2x.png") !important;
            }
        }
    }
</style>
