<script lang="ts">
    import { disableRestrictedContent } from "@src/utils/features";
    import { communityPreviewState } from "@src/utils/preview.svelte";
    import {
        Body,
        Button,
        Chip,
        ColourVars,
        CommonButton,
        Container,
        FloatingButton,
        MenuItem,
        Overview,
        Search,
        SectionHeader,
        Sheet,
        Subtitle,
        transition,
    } from "component-lib";
    import {
        anonUserStore,
        botState,
        exploreCommunitiesFiltersStore,
        identityStateStore,
        offlineStore,
        publish,
        showUnpublishedBots,
        type AiAppRegistration,
        type BotMatch,
        type CommunityMatch,
        type OpenChat,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import LoadMore from "svelte-material-icons/CloudDownloadOutline.svelte";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import Filter from "svelte-material-icons/FilterVariant.svelte";
    import AutoFix from "svelte-material-icons/AutoFix.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import { fade } from "svelte/transition";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import {
        aiAppSearchState,
        botSearchState,
        communitySearchState,
        SearchState,
    } from "../../../../stores/search.svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import Translatable from "../../../Translatable.svelte";
    import AnonFooter from "../../AnonFooter.svelte";
    import NothingToSee from "../../NothingToSee.svelte";
    import { updateCommunityState } from "../createOrUpdate/community.svelte";
    import type { SurfaceOpening } from "@utils/aiAppSurfaces";
    import AiAppLinkSheet from "../../AiAppLinkSheet.svelte";
    import AiAppSurfaceSheet from "../../AiAppSurfaceSheet.svelte";
    import AiAppCard from "./AiAppCard.svelte";
    import AiAppSheet from "./AiAppSheet.svelte";
    import BotCard from "./BotCard.svelte";
    import BotFilters from "./BotFilters.svelte";
    import CommunityCard from "./CommunityCard.svelte";
    import CommunityMatchComponent from "./CommunityMatch.svelte";
    import CommunityFilters from "./Filters.svelte";

    const client = getContext<OpenChat>("client");

    type View = "communities" | "bots" | "aiApps";
    let searching = $state(false);
    let showFab = $state(false);
    let scrollableElement: HTMLElement | undefined;
    let initialised = $state(false);
    let view = $state<View>("communities");
    let showingFilters = $state(false);
    let selectedCommunity = $state<CommunityMatch>();

    let searchState = $derived<SearchState<CommunityMatch | BotMatch | AiAppRegistration>>(
        view === "communities"
            ? communitySearchState
            : view === "bots"
              ? botSearchState
              : aiAppSearchState,
    );

    function clear() {
        searchState.term = "";
        communitySearchState.term = "";
        botSearchState.term = "";
        aiAppSearchState.term = "";
        search(true);
    }

    function createCommunity() {
        updateCommunityState.createCommunity(client);
    }

    function registerBot() {
        if (anonUserStore.value) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "register_bot" },
            });
            return;
        } else {
            publish("registerBot");
        }
    }

    function searchCommunities(
        filters: {
            languages: string[];
            flags: number;
        },
        reset = false,
    ) {
        if (reset) {
            communitySearchState.reset();
        } else {
            communitySearchState.nextPage();
        }
        client
            .exploreCommunities(
                communitySearchState.term === "" ? undefined : communitySearchState.term,
                communitySearchState.index,
                8,
                disableRestrictedContent ? 0 : (filters.flags ?? 0),
                filters.languages,
            )
            .then((results) => {
                if (results.kind === "success") {
                    if (reset) {
                        communitySearchState.results = results.matches;
                    } else {
                        communitySearchState.appendResults(results.matches);
                    }
                    communitySearchState.total = results.total;
                }
            })
            .finally(() => (searching = false));
    }

    function searchBots(showUnpublished: boolean) {
        botSearchState.results = [...botState.externalBots.values()]
            .filter(
                (b) =>
                    (b.registrationStatus.kind === "public" || showUnpublished) &&
                    (b.name.toLocaleLowerCase().includes(botSearchState.term.toLocaleLowerCase()) ||
                        b.definition.description
                            .toLocaleLowerCase()
                            .includes(botSearchState.term.toLocaleLowerCase())),
            )
            .map((b) => ({
                ...b,
                kind: "bot_match",
            }));
        searching = false;
    }

    // Query-driven like communities (the published AI-app directory lives on the user_index; there
    // is no locally-synced state to filter, unlike bots).
    function searchAiApps(reset = false) {
        if (reset) {
            aiAppSearchState.reset();
        } else {
            aiAppSearchState.nextPage();
        }
        client
            .exploreAiApps(
                aiAppSearchState.term === "" ? undefined : aiAppSearchState.term,
                aiAppSearchState.index,
                8,
            )
            .then((results) => {
                if (reset) {
                    aiAppSearchState.results = results.matches;
                } else {
                    aiAppSearchState.appendResults(results.matches);
                }
                aiAppSearchState.total = results.total;
            })
            .finally(() => (searching = false));
        // Refresh the connected set so cards can show the "Connected" badge.
        refreshConnected();
    }

    let connectedAppIds = $state(new Set<number>());
    // The app whose detail sheet is open, and the app whose pairing sheet is open (the two swap:
    // Connect in the detail sheet closes it and opens the pairing sheet).
    let selectedApp = $state<AiAppRegistration | undefined>(undefined);
    let linkingApp = $state<AiAppRegistration | undefined>(undefined);
    // A "sheet"-display surface being shown in the embedded in-window browser.
    let appSurface = $state<SurfaceOpening | undefined>(undefined);

    function refreshConnected() {
        client.myAiAppKeys().then((keys) => {
            connectedAppIds = new Set(
                keys.filter((k) => k.publicKey.length > 0).map((k) => k.appId),
            );
        });
    }

    function search(reset = false) {
        searchFor(view, reset);
    }

    // Takes the view EXPLICITLY: setView must search the TARGET view, but `view` itself is only
    // assigned inside the view-transition callback, which runs asynchronously when the browser
    // supports startViewTransition — reading `view` here at click time would search the OLD tab
    // (harmless for communities/bots, whose results the onMount subscriptions populate anyway,
    // but it left the query-driven AI-apps tab permanently empty on first open).
    function searchFor(v: View, reset: boolean) {
        searching = true;
        if (v === "communities") {
            searchCommunities($exploreCommunitiesFiltersStore, reset);
        } else if (v === "bots") {
            searchBots($showUnpublishedBots);
        } else {
            searchAiApps(reset);
        }
    }

    onMount(() => {
        tick().then(() => {
            if (scrollableElement) {
                scrollableElement.scrollTop = searchState.scrollPos;
                scrollableElement.addEventListener("scroll", onScroll);
            }
            onScroll();
        });

        return () => {
            scrollableElement?.removeEventListener("scroll", onScroll);
        };
    });

    $effect(() => {
        const filters = $exploreCommunitiesFiltersStore;
        untrack(() => {
            if (initialised || communitySearchState.results.length === 0) {
                searchCommunities(filters, true);
            }
            initialised = true;
        });
    });

    $effect(() => {
        const show = $showUnpublishedBots;
        untrack(() => {
            if (initialised || botSearchState.results.length === 0) {
                searchBots(show);
            }
            initialised = true;
        });
    });

    function setView(v: View) {
        transition(["fade"], () => {
            view = v;
        });
        searchFor(v, true);
    }

    function scrollToTop() {
        if (scrollableElement) {
            scrollableElement.scrollTop = 0;
        }
    }

    function onScroll() {
        if (scrollableElement) {
            showFab = scrollableElement.scrollTop > 500;
            searchState.scrollPos = scrollableElement.scrollTop;
        }
    }
    let more = $derived(searchState.total > searchState.results.length);
    let loading = $derived(searching && searchState.results.length === 0);

    function goToCommunity(community: CommunityMatch) {
        communityPreviewState.setOrigin(community.id.communityId, "/communities");
        navigate(`/community/${community.id.communityId}`);
    }

    function showCommunity(community: CommunityMatch) {
        selectedCommunity = community;
    }

    function scrolledToBottom(fromEnd: number) {
        if (fromEnd < 100 && more && !searching) {
            search(false);
        }
    }
</script>

{#if selectedCommunity !== undefined}
    <Sheet onDismiss={() => (selectedCommunity = undefined)}>
        <Container padding={"lg"} direction={"vertical"} gap={"md"}>
            {@const community = selectedCommunity}
            <CommunityCard
                id={community.id.communityId}
                name={community.name}
                description={community.description}
                avatar={community.avatar}
                banner={community.banner}
                memberCount={community.memberCount}
                channelCount={community.channelCount}
                header={false}
                gateConfig={community.gateConfig}
                language={community.primaryLanguage}
                flags={community.flags}
                verified={community.verified}
            />
            <Button onClick={() => goToCommunity(community)}>
                {#snippet icon(color)}
                    <EyeOutline {color} />
                {/snippet}
                View community</Button
            >
        </Container>
    </Sheet>
{/if}

{#if showingFilters}
    <Sheet onDismiss={() => (showingFilters = false)}>
        {#if view === "communities"}
            <CommunityFilters />
        {:else}
            <BotFilters />
        {/if}
    </Sheet>
{/if}

{#snippet communityCard(community: CommunityMatch)}
    <CommunityMatchComponent onClick={() => showCommunity(community)} {community} />
{/snippet}

<Container
    bind:ref={scrollableElement}
    onInsideEnd={scrolledToBottom}
    height={"fill"}
    parentDirection={"vertical"}
    gap={"xl"}
    direction={"vertical"}
    padding={["zero", "zero", "huge"]}
>
    <!-- TODO Explore does not have a hedear -->
    <SectionHeader onAction={createCommunity} onBack={() => history.back()}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("communities.exploreMobile")} />
        {/snippet}
        {#snippet menu()}
            <MenuItem onclick={createCommunity}>
                <Translatable resourceKey={i18nKey("communities.create")} />
            </MenuItem>
            <MenuItem onclick={registerBot}>
                <Translatable resourceKey={i18nKey("Register a bot")} />
            </MenuItem>
        {/snippet}
    </SectionHeader>

    <Container direction={"vertical"} gap={"md"} padding={["zero", "xxl"]}>
        <Overview>
            <Translatable resourceKey={i18nKey("Explore Communities & Bots")} />
        </Overview>
        <Body colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Find communities that resonate with you or maybe start a community of your own. Whether it's crypto, gaming or your favourite sport - this is the place to find your people.",
                )}
            />
        </Body>
    </Container>

    <Container
        supplementalClass={"explore_search_and_chips"}
        direction={"vertical"}
        padding={["zero", "zero", "lg", "zero"]}
        gap={"lg"}
        background={ColourVars.surface0}
    >
        <Container padding={["zero", "lg"]}>
            <Search
                bind:value={searchState.term}
                onClear={clear}
                {searching}
                onSearch={() => search(true)}
                placeholder={interpolate(
                    $_,
                    i18nKey(
                        view === "communities"
                            ? "communities.search"
                            : view === "bots"
                              ? "Search bots"
                              : "aiApps.searchPlaceholder",
                    ),
                )}
            />
        </Container>

        <Container padding={["zero", "xl"]} gap={"sm"}>
            <Chip
                onClick={() => setView("communities")}
                mode={view === "communities" ? "rounded" : "unselected"}
            >
                {#snippet icon(color)}
                    <Account {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Communities")} />
            </Chip>
            <Chip onClick={() => setView("bots")} mode={view === "bots" ? "rounded" : "unselected"}>
                {#snippet icon(color)}
                    <Robot {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Bots")} />
            </Chip>
            <Chip
                onClick={() => setView("aiApps")}
                mode={view === "aiApps" ? "rounded" : "unselected"}
            >
                {#snippet icon(color)}
                    <AutoFix {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("aiApps.exploreChip")} />
            </Chip>
        </Container>
    </Container>

    <Container
        height={loading || searchState.results.length === 0 ? "fill" : "hug"}
        crossAxisAlignment={loading ? "center" : "start"}
        mainAxisAlignment={loading ? "center" : "start"}
        gap={"md"}
        direction={"vertical"}
        padding={["zero", "lg", "md", "lg"]}
    >
        {#if loading}
            <FancyLoader size={"4rem"} />
        {:else if searchState.results.length === 0}
            <Container
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                gap={"sm"}
                height={"fill"}
                direction={"vertical"}
            >
                {#if $offlineStore}
                    <CloudOffOutline size={"1.8em"} />
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("offlineError")} />
                    </Subtitle>
                {:else}
                    <NothingToSee
                        reset={{
                            onClick:
                                view === "communities"
                                    ? createCommunity
                                    : view === "bots"
                                      ? registerBot
                                      : clear,
                            text:
                                view === "communities"
                                    ? "Create a community"
                                    : view === "bots"
                                      ? "Register a bot"
                                      : "Clear search",
                        }}
                        subtitle={interpolate($_, i18nKey("communities.refineSearch"))}
                        title={interpolate(
                            $_,
                            i18nKey(
                                view === "communities"
                                    ? "communities.noMatch"
                                    : view === "bots"
                                      ? "No matching bots"
                                      : "aiApps.noMatch",
                            ),
                        )}
                    ></NothingToSee>
                {/if}
            </Container>
        {:else}
            {#if view === "communities"}
                <Container
                    padding={$anonUserStore ? ["zero", "lg", "huge", "lg"] : ["zero", "lg"]}
                    direction={"vertical"}
                    gap={"lg"}
                >
                    {#each communitySearchState.results as community (community.id.communityId)}
                        {@render communityCard(community)}
                    {/each}
                </Container>
            {:else if view === "bots"}
                <Container
                    padding={$anonUserStore ? ["zero", "lg", "huge", "lg"] : ["zero", "lg"]}
                    direction={"vertical"}
                    gap={"lg"}
                >
                    {#each botSearchState.results as bot (bot.id)}
                        <BotCard
                            onSelect={(id) =>
                                publish("showBot", { bot: botState.externalBots.get(id)! })}
                            {bot}
                        />
                    {/each}
                </Container>
            {:else}
                <Container
                    padding={$anonUserStore ? ["zero", "lg", "huge", "lg"] : ["zero", "lg"]}
                    direction={"vertical"}
                    gap={"lg"}
                >
                    {#each aiAppSearchState.results as app (app.id)}
                        <AiAppCard
                            {app}
                            connected={connectedAppIds.has(app.id)}
                            onSelect={() => (selectedApp = app)}
                        />
                    {/each}
                </Container>
            {/if}
            {#if more}
                <Container mainAxisAlignment={"center"}>
                    <CommonButton
                        size={"small_text"}
                        onClick={() => search(false)}
                        disabled={searching}
                        loading={searching}
                    >
                        {#snippet icon(color, size)}
                            <LoadMore {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("communities.loadMore")} />
                    </CommonButton>
                </Container>
            {/if}
        {/if}
    </Container>
</Container>

{#if $anonUserStore && $identityStateStore.kind !== "logging_in" && $identityStateStore.kind !== "registering"}
    <AnonFooter>
        <FloatingButton onClick={() => (showingFilters = true)}>
            {#snippet icon(color)}
                <Filter {color} />
            {/snippet}
        </FloatingButton>
    </AnonFooter>
{:else}
    <FloatingButton onClick={() => (showingFilters = true)} pos={{ bottom: "lg", right: "lg" }}>
        {#snippet icon(color)}
            <Filter {color} />
        {/snippet}
    </FloatingButton>
{/if}

{#if showFab}
    <div transition:fade class="fab">
        <FloatingButton onClick={scrollToTop}>
            {#snippet icon(color)}
                <ArrowUp {color} />
            {/snippet}
        </FloatingButton>
    </div>
{/if}

{#if selectedApp !== undefined}
    {@const app = selectedApp}
    <AiAppSheet
        {app}
        connected={connectedAppIds.has(app.id)}
        onDismiss={() => (selectedApp = undefined)}
        onConnect={() => {
            linkingApp = app;
            selectedApp = undefined;
        }}
        onOpenSurface={(opening) => {
            appSurface = opening;
            selectedApp = undefined;
        }}
        onDisconnected={refreshConnected}
    />
{/if}

{#if linkingApp !== undefined}
    <AiAppLinkSheet
        app={linkingApp}
        onDismiss={() => (linkingApp = undefined)}
        onLinked={() => {
            linkingApp = undefined;
            refreshConnected();
        }}
    />
{/if}

{#if appSurface !== undefined}
    <AiAppSurfaceSheet
        title={appSurface.app.manifest.name}
        url={appSurface.url}
        display={appSurface.surface.display}
        dataDisclosures={appSurface.dataDisclosures}
        onDismiss={() => (appSurface = undefined)}
    />
{/if}

<style lang="scss">
    :global(.container.explore_search_and_chips) {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    $size: 150px;

    .fab {
        position: absolute;
        bottom: 5.5rem;
        right: var(--sp-lg);
    }

    .img {
        background-repeat: no-repeat;
        width: 1rem;
        height: 1rem;

        &.public {
            background-image: url("/assets/unlocked.svg");
        }

        &.private {
            background-image: url("/assets/locked.svg");
        }
    }

    .robot {
        border: 4px solid var(--surface-0);
        background-color: var(--primary);
        border-radius: var(--rad-circle);
        width: 2rem;
        height: 2rem;
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
        bottom: -2px;
        right: -2px;
    }
</style>
