<script lang="ts">
    import {
        Avatar,
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
        transition,
    } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        botState,
        exploreCommunitiesFiltersStore,
        identityStateStore,
        ModerationFlags,
        offlineStore,
        publish,
        showUnpublishedBots,
        type BotMatch,
        type CommunityMatch,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import LoadMore from "svelte-material-icons/CloudDownloadOutline.svelte";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Filter from "svelte-material-icons/FilterVariant.svelte";
    import RobotSolid from "svelte-material-icons/Robot.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import { fade } from "svelte/transition";
    import { i18nKey, interpolate, supportedLanguagesByCode } from "../../../../i18n/i18n";
    import {
        botSearchState,
        communitySearchState,
        SearchState,
    } from "../../../../stores/search.svelte";
    import BotAvatar from "../../../bots/BotAvatar.svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import WithVerifiedBadge from "../../../icons/WithVerifiedBadge.svelte";
    import Translatable from "../../../Translatable.svelte";
    import AnonFooter from "../../AnonFooter.svelte";
    import Markdown from "../../Markdown.svelte";
    import NothingToSee from "../../NothingToSee.svelte";
    import { updateCommunityState } from "../createOrUpdate/community.svelte";
    import BotFilters from "./BotFilters.svelte";
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

    $inspect($identityStateStore);

    function clear() {
        searchState.term = "";
        communitySearchState.term = "";
        botSearchState.term = "";
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
                32,
                filters.flags ?? 0,
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

    function search(reset = false) {
        searching = true;
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
            if (initialised || communitySearchState.results.length === 0) {
                searchCommunities(filters, true);
            }
            initialised = true;
        });

        const unsubBot = showUnpublishedBots.subscribe((show) => {
            if (initialised || botSearchState.results.length === 0) {
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
    function serialiseFlags(flags: number) {
        const f: string[] = [];
        if (client.hasModerationFlag(flags, ModerationFlags.Adult)) {
            f.push("communities.adult");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.Offensive)) {
            f.push("communities.offensive");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.UnderReview)) {
            f.push("communities.underReview");
        }
        return f;
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

{#snippet botCard(bot: BotMatch)}
    {@const isPublic = botState.externalBots.get(bot.id)?.registrationStatus?.kind === "public"}
    {@const owner = $allUsersStore.get(bot.ownerId)}
    <Container
        onClick={() => publish("showBot", { bot: botState.externalBots.get(bot.id)! })}
        padding={["sm", "zero"]}
        direction={"vertical"}>
        <Container overflow={"hidden"} gap={"md"}>
            <BotAvatar size={"xxl"} {bot}>
                <div class="robot">
                    <RobotSolid size={"1rem"} color={ColourVars.textOnPrimary} />
                </div>
            </BotAvatar>
            <Container gap={"xs"} direction={"vertical"}>
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <div class={`img ${isPublic ? "public" : "private"}`}></div>
                    <Subtitle fontWeight={"bold"}>
                        {bot.name}
                    </Subtitle>
                </Container>
                <BodySmall colour={"textSecondary"}>
                    <Markdown oneLine text={bot.definition.description} />
                </BodySmall>
                {#if owner}
                    <Container gap={"xs"}>
                        <BodySmall width={"hug"}>Owned by</BodySmall>
                        <BodySmall width={"hug"} fontWeight={"bold"} colour={"secondary"}>
                            @{owner.username}
                        </BodySmall>
                    </Container>
                {/if}
            </Container>
        </Container>
    </Container>
{/snippet}

{#snippet communityCard(community: CommunityMatch)}
    <Container padding={["sm", "zero"]} direction={"vertical"}>
        <Container overflow={"hidden"} gap={"md"}>
            <Avatar
                radius={"lg"}
                size={"xxl"}
                url={client.communityAvatarUrl(community.id.communityId, community.avatar)}>
            </Avatar>
            <Container direction={"vertical"}>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <WithVerifiedBadge
                        verified={community.verified}
                        size={"small"}
                        tooltip={i18nKey("verified.verified", undefined, "community")}>
                        <Subtitle fontWeight={"bold"}>
                            {community.name}
                        </Subtitle>
                    </WithVerifiedBadge>
                </Container>
                <BodySmall colour={"textSecondary"}>
                    <Markdown twoLine inline={false} text={community.description} />
                </BodySmall>
                <BodySmall colour={"secondary"}>
                    {community.memberCount.toLocaleString()} member(s), {supportedLanguagesByCode[
                        community.primaryLanguage
                    ]?.name}
                </BodySmall>
                <Container gap={"sm"} wrap>
                    {#each serialiseFlags(community.flags) as flag}
                        <Chip mode={"default"}>
                            <Translatable resourceKey={i18nKey(flag)} />
                        </Chip>
                    {/each}
                </Container>
            </Container>
        </Container>
    </Container>
{/snippet}

<Container
    bind:ref={scrollableElement}
    height={"fill"}
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

    <Container
        height={loading || searchState.results.length === 0 ? "fill" : "hug"}
        crossAxisAlignment={loading ? "center" : "start"}
        mainAxisAlignment={loading ? "center" : "start"}
        gap={"md"}
        direction={"vertical"}
        padding={["zero", "lg", "md", "lg"]}>
        {#if loading}
            <FancyLoader size={"4rem"} />
        {:else if searchState.results.length === 0}
            <Container
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                gap={"sm"}
                height={"fill"}
                direction={"vertical"}>
                {#if $offlineStore}
                    <CloudOffOutline size={"1.8em"} />
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("offlineError")} />
                    </Subtitle>
                {:else}
                    <NothingToSee
                        reset={{
                            onClick: view === "communities" ? createCommunity : registerBot,
                            text: view === "communities" ? "Create a community" : "Register a bot",
                        }}
                        subtitle={interpolate($_, i18nKey("communities.refineSearch"))}
                        title={interpolate(
                            $_,
                            i18nKey(
                                view === "communities" ? "communities.noMatch" : "No matching bots",
                            ),
                        )}>
                    </NothingToSee>
                {/if}
            </Container>
        {:else}
            {#if view === "communities"}
                <Container
                    padding={$anonUserStore ? ["zero", "lg", "huge", "lg"] : ["zero", "lg"]}
                    direction={"vertical"}
                    gap={"lg"}>
                    {#each communitySearchState.results as community (community.id.communityId)}
                        <CommunityCardLink url={`/community/${community.id.communityId}`}>
                            {@render communityCard(community)}
                        </CommunityCardLink>
                    {/each}
                </Container>
            {:else}
                <Container
                    padding={$anonUserStore ? ["zero", "lg", "huge", "lg"] : ["zero", "lg"]}
                    direction={"vertical"}
                    gap={"lg"}>
                    {#each botSearchState.results as bot (bot.id)}
                        {@render botCard(bot)}
                    {/each}
                </Container>
            {/if}
            {#if more}
                <Container mainAxisAlignment={"center"}>
                    <CommonButton
                        size={"small_text"}
                        onClick={() => search(false)}
                        disabled={searching}
                        loading={searching}>
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
        border: 4px solid var(--background-0);
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
