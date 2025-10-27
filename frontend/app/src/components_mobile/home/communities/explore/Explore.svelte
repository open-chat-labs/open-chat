<script lang="ts">
    import {
        BigButton,
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        FloatingButton,
        IconButton,
        Search,
        SectionHeader,
        Sheet,
        Subtitle,
        Title,
        UserChip,
    } from "component-lib";
    import type { BotMatch, CommunityMatch, OpenChat } from "openchat-client";
    import {
        allUsersStore,
        botState,
        exploreCommunitiesFiltersStore,
        offlineStore,
        showUnpublishedBots,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import {
        botSearchState,
        communitySearchState,
        SearchState,
    } from "../../../../stores/search.svelte";
    import BotAvatar from "../../../bots/BotAvatar.svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import Translatable from "../../../Translatable.svelte";
    import Markdown from "../../Markdown.svelte";
    import BotFilters from "./BotFilters.svelte";
    import CommunityCard from "./CommunityCard.svelte";
    import CommunityCardLink from "./CommunityCardLink.svelte";
    import CommunityFilters from "./Filters.svelte";

    const client = getContext<OpenChat>("client");

    type View = "communities" | "bots";
    let searching = $state(false);
    let showFab = $state(false);
    let scrollableElement: HTMLElement | undefined;
    let initialised = $state(false);
    let view = $state<View>("communities");
    let showingFilters = $state(false);

    let searchState = $derived<SearchState<CommunityMatch | BotMatch>>(
        view === "communities" ? communitySearchState : botSearchState,
    );

    function selectView(v: View) {
        view = v;
        search(true);
    }

    function clear() {
        searchState.term = "";
        search(true);
    }

    function searchCommunities(
        filters: {
            languages: string[];
            flags: number;
        },
        reset = false,
    ) {
        searching = true;
        if (reset) {
            searchState.reset();
        } else {
            searchState.nextPage();
        }
        client
            .exploreCommunities(
                searchState.term === "" ? undefined : searchState.term,
                searchState.index,
                32,
                filters.flags ?? 0,
                filters.languages,
            )
            .then((results) => {
                if (results.kind === "success") {
                    if (reset) {
                        searchState.results = results.matches;
                    } else {
                        searchState.appendResults(results.matches);
                    }
                    searchState.total = results.total;
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
    }

    function search(reset = false) {
        if (view === "communities") {
            searchCommunities($exploreCommunitiesFiltersStore, reset);
        } else {
            searchBots($showUnpublishedBots);
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

        const unsub = exploreCommunitiesFiltersStore.subscribe((filters) => {
            if (initialised || searchState.results.length === 0) {
                searchCommunities(filters, true);
            }
            initialised = true;
        });

        const unsubBot = showUnpublishedBots.subscribe((show) => {
            if (initialised || searchState.results.length === 0) {
                searchBots(show);
            }
            initialised = true;
        }, undefined);

        return () => {
            scrollableElement?.removeEventListener("scroll", onScroll);
            unsub();
            unsubBot();
        };
    });

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

    let installing = $state<BotMatch>();
    let showInstalling = $state(false);
    function hideInstalling() {
        showInstalling = false;
    }
</script>

{#if showingFilters}
    <Sheet onDismiss={() => (showingFilters = false)}>
        {#if view === "communities"}
            <CommunityFilters />
        {:else}
            <BotFilters />
        {/if}
    </Sheet>
{/if}

{#if showInstalling && installing}
    <Sheet onDismiss={hideInstalling}>
        {@render botCard(installing)}
        <Body align={"center"} colour={"textSecondary"}>This is where we will do the install</Body>
    </Sheet>
{/if}

{#snippet botCard(bot: BotMatch)}
    {@const isPublic = botState.externalBots.get(bot.id)?.registrationStatus?.kind === "public"}
    {@const owner = $allUsersStore.get(bot.ownerId)}
    <Container
        onClick={() => {
            installing = bot;
            showInstalling = true;
        }}
        padding={"lg"}
        borderRadius={"md"}
        background={ColourVars.background1}
        direction={"vertical"}>
        <Container gap={"sm"}>
            <BotAvatar {bot} />
            <Container gap={"sm"} direction={"vertical"}>
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <div class={`img ${isPublic ? "public" : "private"}`}></div>
                    <Title fontWeight={"bold"}>
                        {bot.name}
                    </Title>
                </Container>
                <BodySmall>
                    <Markdown inline={false} text={bot.definition.description} />
                </BodySmall>
                <UserChip avatarUrl={client.userAvatarUrl(owner)}>@{owner?.username}</UserChip>
            </Container>
        </Container>
    </Container>
{/snippet}

<Container height={{ kind: "fill" }} parentDirection={"vertical"} gap={"sm"} direction={"vertical"}>
    <SectionHeader onBack={() => history.back()}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("communities.exploreMobile")} />
        {/snippet}
        {#snippet action()}
            <IconButton onclick={() => (showingFilters = true)}>
                {#snippet icon(color)}
                    <Tune {color} />
                {/snippet}
            </IconButton>
        {/snippet}
    </SectionHeader>

    <Container padding={["zero", "md"]}>
        <Search
            bind:value={searchState.term}
            onClear={clear}
            {searching}
            onSearch={() => search(true)}
            placeholder={interpolate(
                $_,
                i18nKey(view === "communities" ? "communities.search" : "Search bots"),
            )} />
    </Container>

    <Container
        bind:ref={scrollableElement}
        gap={"md"}
        height={{ kind: "fill" }}
        direction={"vertical"}
        padding={["md", "md"]}>
        {#if loading}
            <div class="loading">
                <FancyLoader />
            </div>
        {:else if searchState.results.length === 0}
            <Container
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                gap={"sm"}
                direction={"vertical"}
                padding={["lg", "zero"]}>
                {#if $offlineStore}
                    <CloudOffOutline size={"1.8em"} />
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("offlineError")} />
                    </Subtitle>
                {:else}
                    <Title align={"center"} fontWeight="bold">
                        {#if view === "communities"}
                            <Translatable resourceKey={i18nKey("communities.noMatch")} />
                        {:else}
                            <Translatable resourceKey={i18nKey("No bots found")} />
                        {/if}
                    </Title>
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("communities.refineSearch")} />
                    </Subtitle>
                {/if}
            </Container>
        {:else}
            {#if view === "communities"}
                {#each communitySearchState.results as community (community.id.communityId)}
                    <CommunityCardLink url={`/community/${community.id.communityId}`}>
                        <CommunityCard
                            id={community.id.communityId}
                            name={community.name}
                            description={community.description}
                            avatar={community.avatar}
                            banner={community.banner}
                            memberCount={community.memberCount}
                            channelCount={community.channelCount}
                            gateConfig={community.gateConfig}
                            language={community.primaryLanguage}
                            flags={community.flags}
                            verified={community.verified} />
                    </CommunityCardLink>
                {/each}
            {:else}
                {#each botSearchState.results as bot (bot.id)}
                    {@render botCard(bot)}
                {/each}
            {/if}
            {#if more}
                <Container mainAxisAlignment={"center"}>
                    <CommonButton
                        width={{ kind: "hug" }}
                        disabled={searching}
                        loading={searching}
                        mode={"active"}
                        onClick={() => search(false)}>
                        {#snippet icon(color)}
                            <Account {color} />
                        {/snippet}
                        <Translatable
                            resourceKey={i18nKey("communities.loadMore")} /></CommonButton>
                </Container>
            {/if}
        {/if}
    </Container>
    <Container padding={["zero", "md"]} gap={"sm"}>
        <BigButton
            mode={view === "communities" ? "active" : "default"}
            onClick={() => selectView("communities")}>
            {#snippet icon(color)}
                <Account {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Communities")} />
        </BigButton>
        <BigButton mode={view === "bots" ? "active" : "default"} onClick={() => selectView("bots")}>
            {#snippet icon(color)}
                <Robot {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Bots")} />
        </BigButton>
    </Container>
</Container>

{#if showFab}
    <div class="fab">
        <FloatingButton onClick={scrollToTop}>
            {#snippet icon(color)}
                <ArrowUp {color} />
            {/snippet}
        </FloatingButton>
    </div>
{/if}

<style lang="scss">
    $size: 150px;

    .loading {
        width: $size;
        margin: auto;
    }

    .fab {
        position: absolute;
        bottom: 5.5rem;
        right: var(--sp-md);
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
</style>
