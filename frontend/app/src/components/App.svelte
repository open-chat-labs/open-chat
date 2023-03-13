<script lang="ts">
    import { onMount, setContext } from "svelte";

    import "../i18n/i18n";
    import "../utils/markdown";
    import { rtlStore } from "../stores/rtl";
    import { _ } from "svelte-i18n";
    import Router from "./Router.svelte";
    import { location, notFound } from "../routes";
    import SwitchDomain from "./SwitchDomain.svelte";
    import Upgrading from "./upgrading/Upgrading.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import { mobileOperatingSystem } from "../utils/devices";
    import { themeStore } from "../theme/themes";
    import "../stores/fontSize";
    import Profiler from "./Profiler.svelte";
    import { OpenChat, SessionExpiryError } from "openchat-client";
    import {
        isCanisterUrl,
        isLandingPageRoute,
        isScrollingRoute,
        redirectLandingPageLinksIfNecessary,
        removeQueryStringParam,
    } from "../utils/urls";
    import { logger } from "../utils/logging";
    import page from "page";

    let viewPortContent = "width=device-width, initial-scale=1";

    function createOpenChatClient(): OpenChat {
        return new OpenChat({
            icUrl: process.env.IC_URL,
            iiDerivationOrigin: process.env.II_DERIVATION_ORIGIN,
            openStorageIndexCanister: process.env.STORAGE_INDEX_CANISTER!,
            groupIndexCanister: process.env.GROUP_INDEX_CANISTER!,
            notificationsCanister: process.env.NOTIFICATIONS_CANISTER!,
            proposalsBotCanister: process.env.PROPOSALS_BOT_CANISTER!,
            onlineCanister: process.env.ONLINE_CANISTER!,
            userIndexCanister: process.env.USER_INDEX_CANISTER!,
            internetIdentityUrl: process.env.INTERNET_IDENTITY_URL!,
            nfidUrl: process.env.NFID_URL!,
            ledgerCanisterICP: process.env.LEDGER_CANISTER_ICP!,
            ledgerCanisterSNS1: process.env.LEDGER_CANISTER_SNS1!,
            ledgerCanisterBTC: process.env.LEDGER_CANISTER_BTC!,
            ledgerCanisterCHAT: process.env.LEDGER_CANISTER_CHAT!,
            userGeekApiKey: process.env.USERGEEK_APIKEY!,
            blobUrlPattern: process.env.BLOB_URL_PATTERN!,
            i18nFormatter: $_,
            logger: logger,
            websiteVersion: process.env.OPENCHAT_WEBSITE_VERSION!,
        });
    }

    let client: OpenChat = createOpenChatClient();

    let profileTrace = client.showTrace();

    setContext<OpenChat>("client", client);

    $: identityState = client.identityState;
    $: landingPage = isLandingPageRoute($location);

    onMount(() => {
        redirectLandingPageLinksIfNecessary();
        if (client.captureReferralCode()) {
            page.replace(removeQueryStringParam("ref"));
        }
        if (mobileOperatingSystem === "iOS") {
            viewPortContent += ", maximum-scale=1";
        }
        calculateHeight();
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
        (<any>window).platformModerator = { addHotGroupExclusion, deleteFrozenGroup, freezeGroup, removeHotGroupExclusion, unfreezeGroup };
        (<any>window).platformOperator = { updateProposalsGroup };
    });

    function addHotGroupExclusion(chatId: string): void {
        client
            .addHotGroupExclusion(chatId)
            .then((success) => {
                if (success) {
                    console.log("Hot group exclusion added", chatId);
                } else {
                    console.log("Failed to add hot group exclusion", chatId);
                }
            })
            .catch((e) => {
                console.log("Failed to add hot group exclusion", e);
            });
    }

    function deleteFrozenGroup(chatId: string): void {
        client
            .deleteFrozenGroup(chatId)
            .then((success) => {
                if (success) {
                    console.log("Group deleted", chatId);
                } else {
                    console.log("Failed to delete frozen group", chatId);
                }
            })
            .catch((e) => {
                console.log("Failed to delete frozen group", e);
            });
    }

    function freezeGroup(chatId: string, reason: string | undefined): void {
        client
            .freezeGroup(chatId, reason)
            .then((success) => {
                if (success) {
                    console.log("Group frozen", chatId);
                } else {
                    console.log("Failed to freeze group", chatId);
                }
            })
            .catch((e) => {
                console.log("Failed to freeze group", e);
            });
    }

    function removeHotGroupExclusion(chatId: string): void {
        client
            .removeHotGroupExclusion(chatId)
            .then((success) => {
                if (success) {
                    console.log("Hot group exclusion removed", chatId);
                } else {
                    console.log("Failed to remove hot group exclusion", chatId);
                }
            })
            .catch((e) => {
                console.log("Failed to remove hot group exclusion", e);
            });
    }

    function unfreezeGroup(chatId: string): void {
        client
            .unfreezeGroup(chatId)
            .then((success) => {
                if (success) {
                    console.log("Group unfrozen", chatId);
                } else {
                    console.log("Failed to unfreeze group", chatId);
                }
            })
            .catch((e) => {
                console.log("Failed to unfreeze group", e);
            });
    }

    function updateProposalsGroup(
        governanceCanisterId: string, 
        name?: string,
        description?: string,
        avatarUrl?: string): void {
        client
            .updateProposalsGroup(
                governanceCanisterId, 
                name, 
                description, 
                avatarUrl)
            .then((success) => {
                if (success) {
                    console.log("Proposals group updated", governanceCanisterId);
                } else {
                    console.log("Failed to update proposals group", governanceCanisterId);
                }
            })
            .catch((e) => {
                console.log("Failed to update proposals group", e);
            });
    }

    $: {
        if (
            !$notFound &&
            (landingPage ||
                $identityState === "requires_login" ||
                $identityState === "logging_in" ||
                $identityState === "registering")
        ) {
            document.body.classList.add("landing-page");
        } else {
            document.body.classList.remove("landing-page");
        }
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

    let isFirefox = navigator.userAgent.indexOf("Firefox") >= 0;
    $: burstPath = $themeStore.name === "dark" ? "../assets/burst_dark" : "../assets/burst_light";
    $: burstUrl = isFirefox ? `${burstPath}.png` : `${burstPath}.svg`;
    $: burstFixed = isScrollingRoute($location);
</script>

{#if $themeStore.burst || landingPage}
    <div
        class:fixed={burstFixed}
        class="burst-wrapper"
        style={`background-image: url(${burstUrl})`} />
{/if}

<svelte:head>
    <meta name="viewport" content={viewPortContent} />
</svelte:head>

{#if isCanisterUrl}
    <SwitchDomain />
{:else if $identityState === "upgrading_user" || $identityState === "upgrade_user"}
    <Upgrading />
{:else if $identityState === "requires_login" || $identityState === "logging_in" || $identityState === "registering" || $identityState === "logged_in" || $identityState === "loading_user"}
    <Router />
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
            --prize: #f79413;
        }

        body {
            transition: background ease-in-out 300ms, color ease-in-out 150ms,
                padding ease-in-out 150ms;
            background: var(--bg);
            color: var(--txt);
            margin: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu,
                Cantarell, "Helvetica Neue", sans-serif;
            font-family: "Roboto", sans-serif;
            font-weight: 400;
            font-size: toRem(16);
            line-height: 135%;

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

            &.landing-page {
                display: block;
                line-height: toRem(28);
                background: var(--landing-bg);
                color: var(--landing-txt);
                min-height: 100vh;
                height: unset;
            }
        }

        h1,
        h2,
        h3,
        h4 {
            font-family: "Manrope", sans-serif;
            font-weight: 700;
        }

        textarea {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu,
                Cantarell, "Helvetica Neue", sans-serif;
        }

        a {
            color: #22a7f2;
            color: var(--primary);
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

    .burst-wrapper {
        overflow: hidden;
        max-width: 100%;
        width: 100%;
        position: absolute;
        height: 100vh;
        min-height: 100%;

        background-repeat: no-repeat;
        background-size: 1400px;
        background-origin: 50% 50%;
        background-position: right 20% top toRem(150);

        &.fixed {
            position: fixed;
        }

        @include mobile() {
            background-size: 800px;
            background-position: left 0 top toRem(150);
        }
    }
</style>
