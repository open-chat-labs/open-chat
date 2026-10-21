<!-- The marketing pages, outside the shell (ROUTES.md, Marketing routes): Landing on "/" signed out,
     /home and /features; Learn on its sub-pages' paths; and the page an email sign-in link opens
     (/home?auth&m=…), which asks for the link's code over Landing. -->
<script lang="ts">
    import {
        identityStateStore,
        querystringStore,
        selectedAuthProviderStore,
        type OpenChat,
        type RouteParams,
    } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import Landing from "@openchat/ui/src/pages/Landing.svelte";
    import Learn from "@openchat/ui/src/pages/Learn.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import type { LearnPage } from "@openchat/ui/src/pages/learnContent";
    import CanisterMapFrame from "@src/core/CanisterMapFrame.svelte";
    import type { PageMode } from "@openchat/ui/src/pages/types";
    import { currentThemeMode, themeType } from "@theme/themes";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Placeholder from "../app/Placeholder.svelte";
    import { AuthDialogProps, pageSignIns } from "../auth/authDialog.svelte";
    import { createAuth } from "../auth/signIn";
    import { accentStore } from "../../accent";
    import { LazyModule } from "../../lazyModule.svelte";
    import { isEmailLinkPage, learnPageFor, learnPath } from "./marketing";

    let { route }: { route: RouteParams } = $props();

    const client = getContext<OpenChat>("client");

    // the app's home: "/" goes on to the default chat list, as the router does for anyone signed in
    const enterApp = () => navigate("/");

    // an emailed link followed elsewhere signs this page in too, so it enters the app
    const auth = createAuth(client, {
        translate: (key) => $_(key),
        onEmailSignedIn: () => {
            pageSignIns.emailDone();
            enterApp();
        },
    });
    const dialog = new AuthDialogProps(auth);
    // the method last used, read as the dialog opens rather than live: starting one doesn't move
    // the tiles
    let last = $state(selectedAuthProviderStore.value);

    // the page's own sign-ins are tracked, so "/" keeps Landing until they're through
    const onMethod = (...args: Parameters<typeof auth.onMethod>) =>
        pageSignIns.track(auth.onMethod(...args));
    const onSignup = (details: Parameters<typeof auth.onSignup>[0]) =>
        pageSignIns.track(auth.onSignup(details), { signup: true });
    // and so is an email link it asks for, until the link signs in or is given up
    const onRequestEmailLink = (address: string) =>
        pageSignIns.trackEmail(Promise.resolve(auth.onRequestEmailLink(address)));
    const onCancelEmailLink = () => {
        pageSignIns.emailDone();
        auth.onCancelEmailLink();
    };
    // closing gives up what the dialog had going, and signs out an identity without an account it
    // leaves behind (a sign-up that failed)
    const onClose = () => {
        pageSignIns.closed();
        auth.cancel();
    };
    const onOpen = () => {
        last = selectedAuthProviderStore.value;
        dialog.opening();
    };
    const pageAuth = $derived({
        ...dialog.props($querystringStore.getAll("auth"), last),
        onOpen,
        onRequestEmailLink,
        onCancelEmailLink,
        onMethod,
        onSignup,
        onClose,
    });

    // leaving the page mid sign-in (Back, a link) walks away from it, as closing its dialog does;
    // a page left because its sign-in went through has nothing going
    onDestroy(() => {
        if (pageSignIns.left()) auth.cancel();
        auth.dispose();
    });

    const signedIn = $derived($identityStateStore.kind === "logged_in");
    const mode = $derived<PageMode>($currentThemeMode);
    const setMode = (next: PageMode) => themeType.set(next);

    const learn = $derived(learnPageFor(route));

    // Learn's content is loaded the first time a Learn page shows, so Landing doesn't carry it; a
    // failed load says so, with a retry that reloads the page (a failed import stays failed)
    const learnLoader = new LazyModule(() => import("./learn"));
    $effect(() => {
        if (learn !== undefined) untrack(() => learnLoader.want());
    });
    const learnContent = $derived(learnLoader.module?.learnContent((key) => $_(key)));
    const landing = $derived(
        route.kind === "home_route" ||
            route.kind === "home_landing_route" ||
            route.kind === "features_route",
    );

    // The page a sign-in link opens: its query (?auth&m=…&s1=…&s2=…) is kept to go with the
    // code, and taken out of the URL straight away, as the old UI does
    let linkQuery = $state<string | undefined>(undefined);
    $effect(() => {
        if (landing && isEmailLinkPage($querystringStore)) {
            untrack(() => {
                linkQuery = window.location.search;
                navigate("/home", "auto");
            });
        }
    });

    async function onLinkCode(code: string) {
        const result = await auth.onLinkCode(linkQuery!, code);
        if (result === "signed_in") {
            linkQuery = undefined;
            enterApp();
        }
        return result;
    }

    // /features is Landing at its features section
    $effect(() => {
        if (route.kind === "features_route") scrollToFeatures();
    });

    async function scrollToFeatures() {
        await tick();
        // instant: Landing makes the page's own scrolling smooth, for its section links
        document.getElementById("landing-features")?.scrollIntoView({ behavior: "instant" });
    }
</script>

{#if landing}
    <Landing
        {mode}
        onModeChange={setMode}
        accent={$accentStore}
        onAccentChange={(next) => accentStore.set(next)}
        homeHref="/home"
        appHref="/"
        exploreHref="/communities"
        learnPageHref={(page: LearnPage) => learnPath(page)}
        playStoreHref="https://play.google.com/apps/testing/com.oclabs.openchat"
        termsHref="/terms"
        privacyHref="/privacy"
        auth={pageAuth}
        onEnterApp={enterApp}
        {signedIn} />
    {#if linkQuery !== undefined}
        <AuthDialog kind="link" {onLinkCode} onClose={() => (linkQuery = undefined)} />
    {/if}
{:else if learn !== undefined && learnContent !== undefined}
    <Learn
        {mode}
        accent={$accentStore}
        homeHref="/home"
        appHref="/"
        exploreHref="/communities"
        page={learn.page}
        post={learn.post}
        learnPageHref={learnPath}
        onNavigate={(page, post) => navigate(learnPath(page, post))}
        content={learnContent}
        section={$querystringStore.get("section") ?? undefined}
        question={$querystringStore.get("q") ?? undefined}
        auth={pageAuth}
        onEnterApp={enterApp}
        {signedIn}>
        {#snippet architecture()}
            <!-- the interactive canister map, which keeps ?section= as the canister it shows -->
            <CanisterMapFrame syncUrl />
        {/snippet}
    </Learn>
{:else if learn !== undefined && learnLoader.failed}
    <div class="page">
        <EmptyState
            preset="error"
            title={$_("unexpectedError")}
            body=" "
            actionLabel="ui.common.retry"
            actionHandler={() => location.reload()} />
    </div>
{:else if learn !== undefined}
    <!-- Learn's content is loading -->
    <div class="page"></div>
{:else}
    <!-- TODO(Learn doc pages): the legal pages and /diamond in Learn's page design (ROUTES.md, decision 5) -->
    <div class="page">
        <Placeholder title="Marketing page" detail={route.kind} />
    </div>
{/if}

<style>
    .page {
        display: grid;
        place-items: center;
        height: 100vh;
        height: 100dvh;
        background: var(--surface-0);
        color: var(--ink);
    }
</style>
