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
    import { placeholderLearnContent, type LearnPage } from "@openchat/ui/src/pages/learnContent";
    import type { PageMode } from "@openchat/ui/src/pages/types";
    import { currentThemeMode, themeType } from "@theme/themes";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Placeholder from "../app/Placeholder.svelte";
    import { AuthDialogProps, pageSignIns } from "../auth/authDialog.svelte";
    import { createAuth } from "../auth/signIn";
    import { isEmailLinkPage, learnPageFor, learnPath } from "./marketing";

    let { route }: { route: RouteParams } = $props();

    const client = getContext<OpenChat>("client");

    // the app's home: "/" goes on to the default chat list, as the router does for anyone signed in
    const enterApp = () => navigate("/");

    // an emailed link followed elsewhere signs this page in too, so it enters the app
    const auth = createAuth(client, { translate: (key) => $_(key), onEmailSignedIn: enterApp });
    const dialog = new AuthDialogProps(auth);
    // the method last used, read as the dialog opens rather than live: starting one doesn't move
    // the tiles
    let last = $state(selectedAuthProviderStore.value);

    // the page's own sign-ins are tracked, so "/" keeps Landing until they're through
    const onMethod = (...args: Parameters<typeof auth.onMethod>) =>
        pageSignIns.track(auth.onMethod(...args));
    const onSignup = (details: Parameters<typeof auth.onSignup>[0]) =>
        pageSignIns.track(auth.onSignup(details), { signup: true });
    // an email link is a new attempt too, though the page doesn't wait on it
    const onRequestEmailLink = (address: string) => {
        pageSignIns.started();
        return auth.onRequestEmailLink(address);
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
        if (route.kind === "features_route") {
            tick().then(() => document.getElementById("landing-features")?.scrollIntoView());
        }
    });
</script>

{#if landing}
    <Landing
        {mode}
        onModeChange={setMode}
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
{:else if learn !== undefined}
    <!-- TODO(Learn content): the existing roadmap, docs, blog and FAQ, converted to LearnContent -->
    <Learn
        {mode}
        homeHref="/home"
        appHref="/"
        exploreHref="/communities"
        page={learn.page}
        post={learn.post}
        learnPageHref={learnPath}
        onNavigate={(page, post) => navigate(learnPath(page, post))}
        content={placeholderLearnContent}
        auth={pageAuth}
        onEnterApp={enterApp}
        {signedIn} />
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
