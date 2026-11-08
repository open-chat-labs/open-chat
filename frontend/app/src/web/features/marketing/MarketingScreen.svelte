<!-- The marketing pages, outside the shell (ROUTES.md, Marketing routes): Landing on "/" signed out,
     /home and /features; Learn on its sub-pages' paths; Learn's doc pages outside its tabs on the
     pages with no design of their own (/terms, /privacy, /guidelines, /csea-reporting, /diamond:
     ROUTES.md, decision 5); and the page an email sign-in link opens (/home?auth&m=…), which asks
     for the link's code over Landing. -->
<script lang="ts">
    import {
        chatsInitialisedStore,
        identityStateStore,
        platformModeratorStore,
        platformOperatorStore,
        querystringStore,
        routeForScope,
        selectedAuthProviderStore,
        type OpenChat,
        type RouteParams,
    } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import Landing from "@openchat/ui/src/pages/Landing.svelte";
    import Learn from "@openchat/ui/src/pages/Learn.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import type { LearnDoc, LearnPage } from "@openchat/ui/src/pages/learnContent";
    import { PageAuthState } from "@openchat/ui/src/pages/pageAuth.svelte";
    import CanisterMapFrame from "@src/core/CanisterMapFrame.svelte";
    import type { PageMode } from "@openchat/ui/src/pages/types";
    import { showsCseaChecklist } from "@src/logic/moderation/cseaChecklist.svelte";
    import { currentThemeMode, themeType } from "@theme/themes";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import { navigate } from "@src/utils/navigation";
    import { ANDROID_APK_URL, ANDROID_PLAY_STORE_URL, copySectionUrl } from "@src/utils/urls";
    import { getContext, onDestroy, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { AuthDialogProps, pageSignIns } from "../auth/authDialog.svelte";
    import { createAuth } from "../auth/signIn";
    import { accentStore } from "@theme/accent";
    import { LazyModule } from "../../lazyModule.svelte";
    import DiamondPageScreen from "../diamond/DiamondPageScreen.svelte";
    import { exploreCommunities } from "../explore/explore.adapter";
    import CseaChecklistScreen from "./CseaChecklistScreen.svelte";
    import { cseaDoc } from "./csea";
    import { FeaturedCommunities } from "./featuredCommunities.svelte";
    import {
        docPageFor,
        isEmailLinkPage,
        isLegalDoc,
        landingCommunities,
        learnPageFor,
        learnPath,
        pinnedLandingCommunity,
    } from "./marketing";

    let { route }: { route: RouteParams } = $props();

    const client = getContext<OpenChat>("client");
    const featured = new FeaturedCommunities(client);

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
        featured.dispose();
    });

    const signedIn = $derived($identityStateStore.kind === "logged_in");
    const mode = $derived<PageMode>($currentThemeMode);
    const setMode = (next: PageMode) => themeType.set(next);

    const learn = $derived(learnPageFor(route));
    const docPage = $derived(docPageFor(route));

    // Learn's content is loaded the first time a Learn page (or a doc page, whose tabs are Learn's)
    // shows, so Landing doesn't carry it; a failed load says so, with a retry that reloads the page
    // (a failed import stays failed)
    const learnLoader = new LazyModule(() => import("./learn"));
    $effect(() => {
        if (learn !== undefined || docPage !== undefined) untrack(() => learnLoader.want());
    });
    const learnContent = $derived(learnLoader.module?.learnContent((key) => $_(key)));

    // the legal docs, each loaded the first time its page shows (the terms are long)
    const legalLoaders = {
        terms: new LazyModule(async () => (await import("./learn/legal/terms")).terms),
        privacy: new LazyModule(async () => (await import("./learn/legal/privacy")).privacy),
        guidelines: new LazyModule(
            async () => (await import("./learn/legal/guidelines")).guidelines,
        ),
    };
    const legalLoader = $derived(isLegalDoc(docPage) ? legalLoaders[docPage] : undefined);
    $effect(() => {
        const loader = legalLoader;
        if (loader !== undefined) untrack(() => loader.want());
    });

    // /csea-reporting is the checklist for platform moderators and operators, and where to report
    // material for anyone else
    const cseaChecklist = $derived(showsCseaChecklist($platformModeratorStore, $platformOperatorStore));

    // the doc a doc page shows, once it's there
    const doc = $derived.by((): LearnDoc | undefined => {
        if (isLegalDoc(docPage)) return legalLoader?.module;
        if (docPage === "csea") return cseaDoc(cseaChecklist);
        if (docPage === "diamond") {
            return { kicker: $_("upgrade.diamond"), title: $_("upgrade.benefits"), sections: [] };
        }
        return undefined;
    });
    const loadFailed = $derived(learnLoader.failed || !!legalLoader?.failed);

    // what every Learn page takes, a sub-page or a doc page: the theme, the routes, the auth, and
    // a doc's ?section= and its copy links (on the site's own origin)
    const learnFrame = $derived({
        mode,
        accent: $accentStore,
        homeHref: "/home",
        appHref: "/",
        exploreHref: "/communities",
        termsHref: "/terms",
        privacyHref: "/privacy",
        learnPageHref: learnPath,
        onNavigate: (page: LearnPage, post?: string) => navigate(learnPath(page, post)),
        section: $querystringStore.get("section") ?? undefined,
        onCopySection: (id: string) => void copySectionUrl(client, id),
        auth: pageAuth,
        onEnterApp: enterApp,
        signedIn,
    });

    // /diamond's Upgrade: the app's Diamond dialog, where it can be paid for (the PIN, the wallet),
    // after signing in when signed out (ROUTES.md, decision 5). It opens over the default chat list,
    // as /profile_summary's ?profile does: "/" goes on to it without the query
    const openDiamondDialog = () =>
        navigate(`${routeForScope(client.getDefaultScope())}?diamond`);
    const diamondSignIn = new PageAuthState(() => ({
        auth: pageAuth,
        onEnterApp: openDiamondDialog,
        appHref: "/",
    }));
    function startDiamondUpgrade() {
        if (signedIn) openDiamondDialog();
        else diamondSignIn.open("login");
    }
    const landing = $derived(
        route.kind === "home_route" ||
            route.kind === "home_landing_route" ||
            route.kind === "features_route",
    );

    // Landing's featured communities: the OpenChat community, then Explore's top ones as Explore
    // shows them, asked for once the client can answer (FeaturedCommunities)
    $effect(() => {
        const ready = $chatsInitialisedStore;
        if (landing) untrack(() => void featured.want(ready));
    });
    // a card opens the community's preview, whose cancel comes back here, as Explore's do to it
    const openCommunity = (communityId: string) =>
        client.setCommunityPreviewOrigin(communityId, window.location.pathname, "landing");
    const communities = $derived.by(() => {
        const { pinned, ranked } = featured.featured;
        const ranking = landingCommunities(
            exploreCommunities(
                ranked,
                (m) => client.communityAvatarUrl(m.id.communityId, m.avatar),
                supportedLanguagesByCode,
            ),
            openCommunity,
        );
        if (pinned === undefined) return ranking;
        const avatar = client.communityAvatarUrl(pinned.id.communityId, pinned.avatar);
        return [pinnedLandingCommunity(pinned, avatar, openCommunity), ...ranking];
    });

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
        {communities}
        playStoreHref={ANDROID_PLAY_STORE_URL}
        apkHref={ANDROID_APK_URL}
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
        {...learnFrame}
        content={learnContent}
        page={learn.page}
        post={learn.post}
        question={$querystringStore.get("q") ?? undefined}>
        {#snippet architecture()}
            <!-- the interactive canister map, which keeps ?section= as the canister it shows -->
            <CanisterMapFrame syncUrl />
        {/snippet}
    </Learn>
{:else if docPage !== undefined && learnContent !== undefined && doc !== undefined}
    <Learn
        {...learnFrame}
        content={learnContent}
        {doc}
        belowDoc={docPage === "diamond" || (docPage === "csea" && cseaChecklist) ? belowDoc : undefined}
        architecture={tabsArchitecture} />
    {#if diamondSignIn.kind}<AuthDialog {...diamondSignIn.dialog} />{/if}
{:else if (learn !== undefined || docPage !== undefined) && loadFailed}
    <div class="page">
        <EmptyState
            preset="error"
            title={$_("unexpectedError")}
            body=" "
            actionLabel="ui.common.retry"
            actionHandler={() => location.reload()} />
    </div>
{:else}
    <!-- Learn's content (or a doc page's) is loading -->
    <div class="page"></div>
{/if}

<!-- a doc page's own content, after its doc -->
{#snippet belowDoc()}
    {#if docPage === "diamond"}
        <DiamondPageScreen onStartUpgrade={startDiamondUpgrade} />
    {:else if docPage === "csea"}
        <CseaChecklistScreen />
    {/if}
{/snippet}

<!-- only for the tabs on a doc page: the Architecture tab shows when Learn has content for it -->
{#snippet tabsArchitecture()}{/snippet}

<style lang="scss">
    .page {
        display: grid;
        place-items: center;
        height: 100vh;
        height: 100dvh;
        background: var(--surface-0);
        color: var(--ink);
    }
</style>
