<script lang="ts">
    import { onMount, setContext } from "svelte";

    import "../i18n/i18n";
    import "../utils/markdown";
    import "../utils/scream";
    import { rtlStore } from "../stores/rtl";
    import { _, isLoading } from "svelte-i18n";
    import Router from "./Router.svelte";
    import { notFound, pathParams } from "../routes";
    import SwitchDomain from "./SwitchDomain.svelte";
    import Upgrading from "./upgrading/Upgrading.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import { currentTheme } from "../theme/themes";
    import "../stores/fontSize";
    import Profiler from "./Profiler.svelte";
    import { OpenChat, UserLoggedIn, type DiamondMembershipFees } from "openchat-client";
    import { type UpdateMarketMakerConfigArgs, inititaliseLogger } from "openchat-client";
    import {
        isCanisterUrl,
        isLandingPageRoute,
        isScrollingRoute,
        redirectLandingPageLinksIfNecessary,
        removeQueryStringParam,
    } from "../utils/urls";
    import "../components/web-components/profileLink";
    import page from "page";
    import { menuStore } from "../stores/menu";
    import { framed, broadcastLoggedInUser } from "../stores/xframe";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import Witch from "./Witch.svelte";
    import Head from "./Head.svelte";
    import { snowing } from "../stores/snow";
    import Snow from "./Snow.svelte";
    overrideItemIdKeyNameBeforeInitialisingDndZones("_id");

    const logger = inititaliseLogger(
        process.env.ROLLBAR_ACCESS_TOKEN!,
        process.env.OPENCHAT_WEBSITE_VERSION!,
        process.env.NODE_ENV!,
    );

    function createOpenChatClient(): OpenChat {
        return new OpenChat({
            icUrl: process.env.IC_URL,
            iiDerivationOrigin: process.env.II_DERIVATION_ORIGIN,
            openStorageIndexCanister: process.env.STORAGE_INDEX_CANISTER!,
            groupIndexCanister: process.env.GROUP_INDEX_CANISTER!,
            notificationsCanister: process.env.NOTIFICATIONS_CANISTER!,
            onlineCanister: process.env.ONLINE_CANISTER!,
            userIndexCanister: process.env.USER_INDEX_CANISTER!,
            translationsCanister: process.env.TRANSLATIONS_CANISTER!,
            registryCanister: process.env.REGISTRY_CANISTER!,
            internetIdentityUrl: process.env.INTERNET_IDENTITY_URL!,
            nfidUrl: process.env.NFID_URL!,
            userGeekApiKey: process.env.USERGEEK_APIKEY!,
            meteredApiKey: process.env.METERED_APIKEY!,
            blobUrlPattern: process.env.BLOB_URL_PATTERN!,
            proposalBotCanister: process.env.PROPOSALS_BOT_CANISTER!,
            marketMakerCanister: process.env.MARKET_MAKER_CANISTER!,
            i18nFormatter: $_,
            logger,
            websiteVersion: process.env.OPENCHAT_WEBSITE_VERSION!,
            rollbarApiKey: process.env.ROLLBAR_ACCESS_TOKEN!,
            env: process.env.NODE_ENV!,
        });
    }

    let client: OpenChat = createOpenChatClient();

    let profileTrace = client.showTrace();

    setContext<OpenChat>("client", client);

    $: identityState = client.identityState;
    $: landingPageRoute = isLandingPageRoute($pathParams);
    $: anonUser = client.anonUser;
    $: homeRoute = $pathParams.kind === "home_route";
    $: showLandingPage =
        landingPageRoute ||
        (homeRoute && $identityState.kind === "anon" && $anonUser) || // show landing page if the anon user hits "/"
        (($identityState.kind === "anon" || $identityState.kind === "logging_in") && $framed); // show landing page if anon and running in a frame

    onMount(() => {
        redirectLandingPageLinksIfNecessary();
        if (client.captureReferralCode()) {
            page.replace(removeQueryStringParam("ref"));
        }
        calculateHeight();

        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
        (<any>window).platformModerator = {
            addHotGroupExclusion,
            deleteFrozenGroup,
            deleteMessage,
            deleteChannelMessage,
            freezeGroup,
            removeHotGroupExclusion,
            setCommunityModerationFlags,
            unfreezeGroup,
            addMessageFilter,
            removeMessageFilter,
            reportedMessages,
        };
        (<any>window).platformOperator = {
            setGroupUpgradeConcurrency,
            setCommunityUpgradeConcurrency,
            setUserUpgradeConcurrency,
            setDiamondMembershipFees,
            stakeNeuronForSubmittingProposals,
            updateMarketMakerConfig,
            pauseEventLoop: () => client.pauseEventLoop(),
            resumeEventLoop: () => client.resumeEventLoop(),
        };

        framed.set(window.self !== window.top);
        client.addEventListener("openchat_event", onUserLoggedIn);
    });

    function onUserLoggedIn(ev: Event) {
        if (ev instanceof UserLoggedIn) {
            broadcastLoggedInUser(ev.detail);
        }
    }

    function addHotGroupExclusion(chatId: string): void {
        client.addHotGroupExclusion({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Hot group exclusion added", chatId);
            } else {
                console.log("Failed to add hot group exclusion", chatId);
            }
        });
    }

    function deleteFrozenGroup(chatId: string): void {
        client.deleteFrozenGroup({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Group deleted", chatId);
            } else {
                console.log("Failed to delete frozen group", chatId);
            }
        });
    }

    function freezeGroup(chatId: string, reason: string | undefined): void {
        client.freezeGroup({ kind: "group_chat", groupId: chatId }, reason).then((success) => {
            if (success) {
                console.log("Group frozen", chatId);
            } else {
                console.log("Failed to freeze group", chatId);
            }
        });
    }

    function removeHotGroupExclusion(chatId: string): void {
        client.removeHotGroupExclusion({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Hot group exclusion removed", chatId);
            } else {
                console.log("Failed to remove hot group exclusion", chatId);
            }
        });
    }

    function setCommunityModerationFlags(communityId: string, flags: number): void {
        client.setCommunityModerationFlags(communityId, flags).then((success) => {
            if (success) {
                console.log("Community moderation flags updated", communityId);
            } else {
                console.log("Failed to set community moderation flags", communityId);
            }
        });
    }

    function unfreezeGroup(chatId: string): void {
        client.unfreezeGroup({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Group unfrozen", chatId);
            } else {
                console.log("Failed to unfreeze group", chatId);
            }
        });
    }

    function addMessageFilter(regex: string): void {
        client.addMessageFilter(regex);
    }

    function removeMessageFilter(id: bigint): void {
        client.removeMessageFilter(id);
    }

    function reportedMessages(userId?: string): void {
        console.log(client.reportedMessages(userId));
    }

    function deleteChannelMessage(
        communityId: string,
        channelId: string,
        messageId: bigint,
        threadRootMessageIndex?: number | undefined,
    ): void {
        client
            .deleteMessage(
                { kind: "channel", communityId, channelId },
                threadRootMessageIndex,
                messageId,
                true,
            )
            .then((success) => {
                if (success) {
                    console.log(
                        "Message deleted",
                        communityId,
                        channelId,
                        messageId,
                        threadRootMessageIndex,
                    );
                } else {
                    console.log(
                        "Failed to delete message",
                        communityId,
                        channelId,
                        messageId,
                        threadRootMessageIndex,
                    );
                }
            });
    }

    function deleteMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number | undefined,
    ): void {
        client
            .deleteMessage(
                { kind: "group_chat", groupId: chatId },
                threadRootMessageIndex,
                messageId,
                true,
            )
            .then((success) => {
                if (success) {
                    console.log("Message deleted", chatId, messageId, threadRootMessageIndex);
                } else {
                    console.log(
                        "Failed to delete message",
                        chatId,
                        messageId,
                        threadRootMessageIndex,
                    );
                }
            });
    }

    function setGroupUpgradeConcurrency(value: number): void {
        client.setGroupUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("Group upgrade concurrency set", value);
            } else {
                console.log("Failed to set group upgrade concurrency", value);
            }
        });
    }

    function setCommunityUpgradeConcurrency(value: number): void {
        client.setCommunityUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("Community upgrade concurrency set", value);
            } else {
                console.log("Failed to set community upgrade concurrency", value);
            }
        });
    }

    function setUserUpgradeConcurrency(value: number): void {
        client.setUserUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("User upgrade concurrency set", value);
            } else {
                console.log("Failed to set user upgrade concurrency", value);
            }
        });
    }

    function setDiamondMembershipFees(fees: DiamondMembershipFees[]): void {
        client.setDiamondMembershipFees(fees).then((success) => {
            if (success) {
                console.log("Diamond membership fees set", fees);
            } else {
                console.log("Failed to set diamond membership fees", fees);
            }
        });
    }

    function stakeNeuronForSubmittingProposals(governanceCanisterId: string, stake: bigint): void {
        client.stakeNeuronForSubmittingProposals(governanceCanisterId, stake).then((success) => {
            if (success) {
                console.log("Neuron staked successfully");
            } else {
                console.log("Failed to stake neuron");
            }
        });
    }

    function updateMarketMakerConfig(config: UpdateMarketMakerConfigArgs): void {
        client.updateMarketMakerConfig(config).then((resp) => {
            if (resp === "success") {
                console.log("Market maker config updated");
            } else {
                console.log("Failed to update market maker config", resp);
            }
        });
    }

    $: {
        if (!$notFound && showLandingPage) {
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
        logger?.error("Unhandled error: ", ev);
        if (
            ev instanceof PromiseRejectionEvent &&
            (ev.reason?.name === "SessionExpiryError" ||
                ev.reason?.name === "InvalidDelegationError")
        ) {
            client.logout();
            ev.preventDefault();
        }
    }

    function resize() {
        menuStore.hideMenu();
        calculateHeight();
    }

    let isFirefox = navigator.userAgent.indexOf("Firefox") >= 0;
    $: burstPath = $currentTheme.mode === "dark" ? "/assets/burst_dark" : "/assets/burst_light";
    $: burstUrl = isFirefox ? `${burstPath}.png` : `${burstPath}.svg`;
    $: burstFixed = isScrollingRoute($pathParams);
</script>

{#if $currentTheme.burst || landingPageRoute}
    <div
        class:fixed={burstFixed}
        class="burst-wrapper"
        style={`background-image: url(${burstUrl})`} />
{/if}

<Head />

<Witch background />

{#if isCanisterUrl}
    <SwitchDomain />
{:else if $identityState.kind === "upgrading_user" || $identityState.kind === "upgrade_user"}
    <Upgrading />
{:else if $identityState.kind === "anon" || $identityState.kind === "logging_in" || $identityState.kind === "registering" || $identityState.kind === "logged_in" || $identityState.kind === "loading_user"}
    {#if !$isLoading}
        <Router {showLandingPage} />
    {/if}
{/if}

{#if profileTrace}
    <Profiler />
{/if}

<UpgradeBanner />

{#if $snowing}
    <Snow />
{/if}

<svelte:window on:resize={resize} on:error={unhandledError} on:orientationchange={resize} />
<svelte:body on:click={() => menuStore.hideMenu()} />

<style lang="scss">
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
            --font-fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans,
                Ubuntu, Cantarell, "Helvetica Neue", sans-serif --font: "Roboto", sans-serif;
            --font: "Roboto", sans-serif;
            --font-bold: "Manrope", sans-serif;
        }

        body {
            transition:
                background ease-in-out 300ms,
                color ease-in-out 150ms,
                padding ease-in-out 150ms;
            background: var(--bg);
            color: var(--txt);
            margin: 0;
            box-sizing: border-box;
            font-family: var(--font-fallback);
            font-family: var(--font);
            font-weight: 400;
            font-size: toRem(16);
            line-height: 135%;

            display: flex;
            height: 100vh;
            height: calc(var(--vh, 1vh) * 100);
            height: 100dvh; // firefox will ignore this
            position: fixed;

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
                position: unset;
            }

            @media (hover: none) {
                @include no_user_select();
            }
        }

        h1,
        h2,
        h3,
        h4 {
            font-family: var(--font-bold);
            font-weight: 700;
        }

        textarea {
            font-family: var(--font-fallback);
            font-family: var(--font);
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

        .tip-dollar {
            @include font-size(fs-260);
            position: absolute;
            pointer-events: none;
            transform-origin: 50% 50%;
            top: -1000px;
            left: -1000px;
            @include z-index("dollar");
        }

        .is-translatable {
            position: relative;
            top: 4px;
        }
    }

    .burst-wrapper {
        overflow: hidden;
        max-width: 100%;
        width: 100%;
        position: absolute;
        height: 100vh;
        min-height: 100%;
        pointer-events: none;
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
