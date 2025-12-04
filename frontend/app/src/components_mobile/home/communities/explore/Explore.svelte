<script lang="ts">
    import {
        Body,
        BodySmall,
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
        Title,
        transition,
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
    import Filter from "svelte-material-icons/FilterVariant.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
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
    import NothingToSee from "../../NothingToSee.svelte";
    import { updateCommunityState } from "../createOrUpdate/community.svelte";
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

    function clear() {
        searchState.term = "";
        search(true);
    }

    function createCommunity() {
        updateCommunityState.createCommunity(client);
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

    function setView(v: View) {
        transition(["fade"], () => {
            view = v;
        });
        search(true);
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
                {#if owner}
                    <UserChip avatarUrl={client.userAvatarUrl(owner)}>@{owner?.username}</UserChip>
                {/if}
            </Container>
        </Container>
    </Container>
{/snippet}

<Container
    bind:ref={scrollableElement}
    height={{ kind: "fill" }}
    parentDirection={"vertical"}
    gap={"xl"}
    direction={"vertical"}>
    <SectionHeader onAction={createCommunity} onBack={() => history.back()}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("communities.exploreMobile")} />
        {/snippet}
        {#snippet menu()}
            <MenuItem onclick={createCommunity}>
                <Translatable resourceKey={i18nKey("communities.create")} />
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
                )} />
        </Body>
    </Container>

    <Container
        supplementalClass={"explore_search_and_chips"}
        direction={"vertical"}
        padding={["zero", "zero", "lg", "zero"]}
        gap={"lg"}
        background={ColourVars.background0}>
        <Container padding={["zero", "lg"]}>
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

        <Container padding={["zero", "xl"]} gap={"sm"}>
            <Chip
                onClick={() => setView("communities")}
                mode={view === "communities" ? "rounded" : "unselected"}>
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
        </Container>
    </Container>

    <Container gap={"md"} direction={"vertical"} padding={["zero", "lg", "md", "lg"]}>
        {#if loading}
            <div class="loading">
                <FancyLoader />
            </div>
        {:else if searchState.results.length === 0}
            <Container
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                gap={"sm"}
                height={{ kind: "fill" }}
                direction={"vertical"}
                padding={["lg", "zero"]}>
                {#if $offlineStore}
                    <CloudOffOutline size={"1.8em"} />
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("offlineError")} />
                    </Subtitle>
                {:else}
                    <NothingToSee
                        reset={{
                            onClick: () => updateCommunityState.createCommunity(client),
                            text: "Create a community",
                        }}
                        subtitle={interpolate($_, i18nKey("communities.refineSearch"))}
                        title={interpolate($_, i18nKey("communities.noMatch"))}>
                    </NothingToSee>
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
                        {#snippet icon(color, size)}
                            <Account {color} {size} />
                        {/snippet}
                        <Translatable
                            resourceKey={i18nKey("communities.loadMore")} /></CommonButton>
                </Container>
            {/if}
        {/if}
    </Container>
</Container>

<FloatingButton onClick={() => (showingFilters = true)} pos={{ bottom: "lg", right: "lg" }}>
    {#snippet icon(color)}
        <Filter {color} />
    {/snippet}
</FloatingButton>

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
    :global(.container.explore_search_and_chips) {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    $size: 150px;

    .loading {
        width: $size;
        margin: auto;
    }

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
</style>
