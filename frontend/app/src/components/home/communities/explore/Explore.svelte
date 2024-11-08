<script lang="ts">
    import ArrowUp from "svelte-material-icons/ArrowUp.svelte";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import {
        ipadWidth,
        mobileWidth,
        screenWidth,
        ScreenWidth,
    } from "../../../../stores/screenDimensions";
    import { iconSize } from "../../../../stores/iconSize";
    import type { OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import { pushRightPanelHistory } from "../../../../stores/rightPanel";
    import { communityFiltersStore } from "../../../../stores/communityFilters";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { derived } from "svelte/store";
    import CommunityCardLink from "./CommunityCardLink.svelte";
    import Translatable from "../../../Translatable.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import {
        communitySearchScrollPos,
        communitySearchStore,
        communitySearchTerm,
    } from "../../../../stores/search";
    import Fab from "../../../Fab.svelte";
    import {
        anonUser,
        offlineStore,
        identityState,
        isDiamond,
        moderationFlags,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let searching = false;
    let showFab = false;
    let scrollableElement: HTMLElement | null;
    let initialised = false;

    $: pageSize = calculatePageSize($screenWidth);
    $: more = $communitySearchStore.total > $communitySearchStore.results.length;
    $: loading = searching && $communitySearchStore.results.length === 0;

    $: {
        if (
            $identityState.kind === "logged_in" &&
            $identityState.postLogin?.kind === "create_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => createCommunity());
        }
    }

    let filters = derived([communityFiltersStore, moderationFlags], ([communityFilters, flags]) => {
        return {
            languages: Array.from(communityFilters.languages),
            flags,
        };
    });

    function calculatePageSize(width: ScreenWidth): number {
        // make sure we get even rows of results
        switch (width) {
            case ScreenWidth.Large:
            case ScreenWidth.ExtraLarge:
                return 30;
            default:
                return 32;
        }
    }

    function createCommunity() {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_community" },
            });
            return;
        }
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            dispatch("createCommunity");
        }
    }

    function search(reset = false) {
        searching = true;
        if (reset) {
            communitySearchStore.reset();
        } else {
            communitySearchStore.nextPage();
        }

        client
            .exploreCommunities(
                $communitySearchTerm === "" ? undefined : $communitySearchTerm,
                $communitySearchStore.index,
                pageSize,
                $filters.flags ?? 0,
                $filters.languages,
            )
            .then((results) => {
                if (results.kind === "success") {
                    if (reset) {
                        communitySearchStore.setResults(results.matches);
                    } else {
                        communitySearchStore.appendResults(results.matches);
                    }
                    communitySearchStore.setTotal(results.total);
                }
            })
            .finally(() => (searching = false));
    }

    function showFilters() {
        pushRightPanelHistory({ kind: "community_filters" });
    }

    onMount(() => {
        tick().then(() => {
            scrollableElement = document.getElementById("communities-wrapper");
            if (scrollableElement) {
                scrollableElement.scrollTop = $communitySearchScrollPos;
            }
            onScroll();
        });
        return filters.subscribe((_) => {
            if (initialised || $communitySearchStore.results.length === 0) {
                search(true);
            }
            initialised = true;
        });
    });

    function scrollToTop() {
        if (scrollableElement) {
            scrollableElement.scrollTop = 0;
        }
    }

    function onScroll() {
        if (scrollableElement) {
            showFab = scrollableElement.scrollTop > 500;
            communitySearchScrollPos.set(scrollableElement.scrollTop);
        }
    }
</script>

<div class="explore">
    <div class="header">
        <div class="title-row">
            <div class="title">
                {#if $mobileWidth}
                    <h4><Translatable resourceKey={i18nKey("communities.exploreMobile")} /></h4>
                {:else}
                    <h4><Translatable resourceKey={i18nKey("communities.explore")} /></h4>
                {/if}
            </div>
            {#if !$ipadWidth}
                <div class="search">
                    <Search
                        fill
                        bind:searchTerm={$communitySearchTerm}
                        searching={false}
                        on:searchEntered={() => search(true)}
                        placeholder={i18nKey("communities.search")} />
                </div>
                <div class="create">
                    <Button on:click={createCommunity} hollow
                        ><Translatable resourceKey={i18nKey("communities.create")} /></Button>
                </div>
            {/if}
            <div class="buttons">
                {#if $ipadWidth}
                    <HoverIcon onclick={createCommunity}>
                        <Plus size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/if}

                <HoverIcon title={$_("showFilters")} onclick={showFilters}>
                    <Tune size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        </div>
        <div class="subtitle-row">
            {#if $ipadWidth}
                <div class="search">
                    <Search
                        searching={false}
                        fill
                        bind:searchTerm={$communitySearchTerm}
                        on:searchEntered={() => search(true)}
                        placeholder={i18nKey("communities.search")} />
                </div>
            {/if}
        </div>
    </div>

    <div on:scroll={onScroll} id="communities-wrapper" class="communities-wrapper">
        <div
            class="communities"
            class:loading
            class:empty={$communitySearchStore.results.length === 0}>
            {#if loading}
                <div class="loading">
                    <FancyLoader />
                </div>
            {:else if $communitySearchStore.results.length === 0}
                {#if $offlineStore}
                    <div class="no-match">
                        <CloudOffOutline size={"1.8em"} color={"var(--txt-light)"} />
                        <p class="sub-header">
                            <Translatable resourceKey={i18nKey("offlineError")} />
                        </p>
                    </div>
                {:else}
                    <div class="no-match">
                        <h4 class="header">
                            <Translatable resourceKey={i18nKey("communities.noMatch")} />
                        </h4>
                        <p class="sub-header">
                            <Translatable resourceKey={i18nKey("communities.refineSearch")} />
                        </p>
                    </div>
                {/if}
            {:else}
                {#each $communitySearchStore.results as community (community.id.communityId)}
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
                            flags={community.flags} />
                    </CommunityCardLink>
                {/each}
            {/if}
        </div>
        {#if more}
            <div class="more">
                <Button disabled={searching} loading={searching} on:click={() => search(false)}
                    ><Translatable resourceKey={i18nKey("communities.loadMore")} /></Button>
            </div>
        {/if}
    </div>
    <div class:show={showFab} class="fab">
        <Fab on:click={scrollToTop}>
            <ArrowUp size={$iconSize} color={"#fff"} />
        </Fab>
    </div>
</div>

<style lang="scss">
    .explore {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp5;
        height: 100%;
        overflow: hidden;
        position: relative;

        @include mobile() {
            padding: $sp3;
            gap: $sp3;
        }
    }

    .header {
        .title-row {
            display: flex;
            align-items: center;
            gap: $sp4;
            margin-bottom: $sp5;

            @include size-below(lg) {
                margin-bottom: $sp3;
                justify-content: space-between;
            }

            .title {
                display: flex;
                gap: $sp3;
                align-items: center;

                h4 {
                    @include font(bold, normal, fs-160, 38);
                    flex: auto;

                    @include mobile() {
                        @include font(bold, normal, fs-140, 38);
                    }
                }
            }

            .search {
                flex: auto;
            }

            .buttons {
                display: flex;
                align-items: center;
                justify-content: flex-end;
            }
        }

        .subtitle-row {
            display: flex;
            justify-content: space-between;
            gap: $sp4;

            @include size-below(lg) {
                flex-direction: column;
            }
        }
    }

    .communities-wrapper {
        @include nice-scrollbar();
        flex: auto;
        height: 3000px;
    }

    .communities {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-gap: $sp5;
        margin-bottom: $sp5;

        @include size-below(xxl) {
            grid-gap: $sp4;
        }

        @include size-below(xl) {
            grid-template-columns: repeat(3, 1fr);
        }

        @include size-below(md) {
            grid-template-columns: repeat(2, 1fr);
        }

        @include size-below(sm) {
            grid-template-columns: repeat(1, 1fr);
        }

        &.loading,
        &.empty {
            height: 100%;
            grid-template-columns: repeat(1, 1fr);
            margin-bottom: 0;
        }
    }

    .more {
        text-align: center;
    }

    $size: 200px;

    .loading {
        width: $size;
        margin: auto;
    }

    .no-match {
        .header {
            @include font(bold, normal, fs-160, 38);
        }
        .sub-header {
            @include font(book, normal, fs-100, 38);
            color: var(--txt-light);
        }
        margin: auto;
        text-align: center;
    }

    .fab {
        transition: opacity ease-in-out 300ms;
        position: absolute;
        @include z-index("fab");
        right: 20px;
        bottom: 20px;
        opacity: 0;
        pointer-events: none;

        &.show {
            opacity: 1;
            pointer-events: all;
        }
    }
</style>
