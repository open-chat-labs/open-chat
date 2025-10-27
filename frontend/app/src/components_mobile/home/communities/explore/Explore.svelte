<script lang="ts">
    import {
        BigButton,
        CommonButton,
        Container,
        FloatingButton,
        IconButton,
        Search,
        SectionHeader,
        Subtitle,
        Title,
    } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { exploreCommunitiesFiltersStore, offlineStore } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import { communitySearchState } from "../../../../stores/search.svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import Translatable from "../../../Translatable.svelte";
    import CommunityCard from "./CommunityCard.svelte";
    import CommunityCardLink from "./CommunityCardLink.svelte";

    const client = getContext<OpenChat>("client");

    type View = "communities" | "bots";
    let searching = $state(false);
    let showFab = $state(false);
    let scrollableElement: HTMLElement | undefined;
    let initialised = $state(false);
    let view = $state<View>("communities");

    function selectView(v: View) {
        view = v;
    }

    function clear() {
        communitySearchState.term = "";
        search($exploreCommunitiesFiltersStore, true);
    }

    function search(filters: { languages: string[]; flags: number }, reset = false) {
        searching = true;
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

    function showFilters() {
        client.pushRightPanelHistory({ kind: "community_filters" });
    }

    onMount(() => {
        tick().then(() => {
            if (scrollableElement) {
                scrollableElement.scrollTop = communitySearchState.scrollPos;
                scrollableElement.addEventListener("scroll", onScroll);
            }
            onScroll();
        });

        const unsub = exploreCommunitiesFiltersStore.subscribe((filters) => {
            if (initialised || communitySearchState.results.length === 0) {
                search(filters, true);
            }
            initialised = true;
        });

        return () => {
            scrollableElement?.removeEventListener("scroll", onScroll);
            unsub();
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
            communitySearchState.scrollPos = scrollableElement.scrollTop;
        }
    }
    let more = $derived(communitySearchState.total > communitySearchState.results.length);
    let loading = $derived(searching && communitySearchState.results.length === 0);
</script>

<Container height={{ kind: "fill" }} parentDirection={"vertical"} gap={"sm"} direction={"vertical"}>
    <SectionHeader onBack={() => history.back()}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("communities.exploreMobile")} />
        {/snippet}
        {#snippet action()}
            <IconButton onclick={showFilters}>
                {#snippet icon(color)}
                    <Tune {color} />
                {/snippet}
            </IconButton>
        {/snippet}
    </SectionHeader>

    <Container padding={["zero", "md"]}>
        <Search
            bind:value={communitySearchState.term}
            onClear={clear}
            {searching}
            onSearch={() => search($exploreCommunitiesFiltersStore, true)}
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
        {:else if communitySearchState.results.length === 0}
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
                        <Translatable resourceKey={i18nKey("communities.noMatch")} />
                    </Title>
                    <Subtitle colour={"textSecondary"} align={"center"}>
                        <Translatable resourceKey={i18nKey("communities.refineSearch")} />
                    </Subtitle>
                {/if}
            </Container>
        {:else}
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
            {#if more}
                <Container mainAxisAlignment={"center"}>
                    <CommonButton
                        width={{ kind: "hug" }}
                        disabled={searching}
                        loading={searching}
                        mode={"active"}
                        onClick={() => search($exploreCommunitiesFiltersStore, false)}>
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
</style>
