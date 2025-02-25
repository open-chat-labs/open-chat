<script lang="ts">
    import {
        AvatarSize,
        i18nKey,
        OpenChat,
        type BotInstallationLocation,
        type CommunityMatch,
        type GroupMatch,
    } from "openchat-client";
    import Legend from "../Legend.svelte";
    import Search from "../Search.svelte";
    import Translatable from "../Translatable.svelte";
    import { getContext } from "svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Avatar from "../Avatar.svelte";
    import SelectedMatch from "../home/proposal/SelectedMatch.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 15;

    type Match = {
        avatarUrl: string;
        name: string;
        id: string;
        entity: CommunityMatch | GroupMatch;
    };

    interface Props {
        location?: BotInstallationLocation;
    }

    let { location = $bindable() }: Props = $props();
    let searching: boolean = $state(false);
    let searchTerm: string = $state("");
    let placeholder = i18nKey("Search for a community, group or user");
    let results: Match[] = $state([]);
    let selected: Match | undefined = $state(undefined);
    location; // usual hack

    async function onPerformSearch(term: string) {
        if (term === "") {
            reset(true);
        } else {
            const [communities, groups] = await Promise.all([
                searchCommunities(term),
                searchGroups(term),
            ]);
            results = [...communities, ...groups];
        }
    }

    function normalise(thing: CommunityMatch | GroupMatch): Match {
        switch (thing.kind) {
            case "community_match":
                return {
                    avatarUrl: client.communityAvatarUrl(thing.id.communityId, thing.avatar),
                    name: thing.name,
                    id: thing.id.communityId,
                    entity: thing,
                };
            case "group_match":
                return {
                    avatarUrl: client.groupAvatarUrl({
                        ...thing,
                        id: thing.chatId,
                    }),
                    name: thing.name,
                    id: thing.chatId.groupId,
                    entity: thing,
                };
        }
    }

    function searchCommunities(term: string): Promise<Match[]> {
        return client
            .exploreCommunities(term === "" ? undefined : term, 0, PAGE_SIZE, 0, [])
            .then((results) => (results.kind === "success" ? results.matches : []))
            .then((res) => res.map(normalise));
    }

    function searchGroups(term: string): Promise<Match[]> {
        return client
            .searchGroups(term, PAGE_SIZE)
            .then((results) => (results.kind === "success" ? results.matches : []))
            .then((res) => res.map(normalise));
    }

    function select(match: Match | undefined) {
        selected = match;
        results = [];
        if (match !== undefined) {
            switch (match.entity.kind) {
                case "community_match":
                    location = { kind: "community", communityId: match.id };
                    break;
                case "group_match":
                    location = { kind: "group_chat", groupId: match.id };
                    break;
            }
        }
    }

    function reset(clearSelected: boolean) {
        results = [];
        searchTerm = "";
        if (clearSelected) {
            select(undefined);
        }
    }
</script>

<div class="bot-install-location" class:showing-menu={results.length > 0}>
    <Legend
        label={i18nKey("bots.builder.testContext")}
        rules={i18nKey("bots.builder.testContextInfo")}></Legend>
    {#if selected !== undefined}
        <SelectedMatch onRemove={() => reset(true)} match={selected.entity}></SelectedMatch>
    {:else}
        <Search inputStyle fill {placeholder} {searching} {searchTerm} {onPerformSearch} />
    {/if}

    {#if results.length > 0}
        <div class="menu">
            <Menu shadow={false}>
                {#each results as match (match.id)}
                    <MenuItem onclick={() => select(match)}>
                        {#snippet icon()}
                            <Avatar url={match.avatarUrl} size={AvatarSize.Small} />
                        {/snippet}
                        {#snippet text()}
                            {match.name}
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        </div>
    {/if}

    <p class="info">
        <Translatable
            resourceKey={i18nKey(
                "Your bot will only be available for installation in the specified context until it is published, which must be done via a proposal.",
            )}></Translatable>
    </p>
</div>

<style lang="scss">
    .bot-install-location {
        margin-bottom: $sp4;

        &.showing-menu {
            :global(.wrapper) {
                border-radius: var(--rd) var(--rd) var(--rd) 0;
            }

            :global(.menu) {
                border-radius: 0 0 var(--rd) var(--rd);
            }

            :global(.menu .menu) {
                border-radius: 0 0 var(--rd) var(--rd);
                border-top: none;
            }
        }
    }
    .info {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        margin-top: $sp3;
    }

    .menu {
        max-height: 250px;
        overflow: auto;
        width: fit-content;
        position: absolute;
        @include z-index("popup-menu");
        box-shadow: var(--menu-sh);
    }
</style>
