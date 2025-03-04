<script lang="ts">
    import {
        AvatarSize,
        globalStateStore,
        i18nKey,
        OpenChat,
        type BotInstallationLocation,
    } from "openchat-client";
    import Legend from "../Legend.svelte";
    import Search from "../Search.svelte";
    import Translatable from "../Translatable.svelte";
    import { getContext, onMount } from "svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Avatar from "../Avatar.svelte";
    import SelectedMatch from "../home/proposal/SelectedMatch.svelte";

    const client = getContext<OpenChat>("client");

    type Match = {
        avatarUrl: string;
        name: string;
        id: string;
        isCommunity: boolean;
    };

    interface Props {
        location?: BotInstallationLocation;
    }

    let { location = $bindable() }: Props = $props();
    let searchTerm: string = $state("");
    let placeholder = i18nKey("Search for a community, group or user");
    let results: Match[] = $state([]);
    let selected: Match | undefined = $state(undefined);
    location; // usual hack

    onMount(() => onPerformSearch(""));

    function onPerformSearch(term: string) {
        const globalState = $globalStateStore;

        const termLower = term.toLowerCase();

        const communities: Match[] = globalState.communities.values()
            .filter((c) => termLower === "" || c.name.toLowerCase().includes(termLower))
            .map((c) => ({
                avatarUrl: client.communityAvatarUrl(c.id.communityId, c.avatar),
                name: c.name,
                id: c.id.communityId,
                isCommunity: true,
            }));

        const groups: Match[] = globalState.groupChats.values()
            .filter((g) => termLower === "" || g.name.toLowerCase().includes(termLower))
            .map((g) => ({
                avatarUrl: client.groupAvatarUrl(g),
                name: g.name,
                id: g.id.groupId,
                isCommunity: false,
            }));

        communities.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        groups.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        results = [...communities, ...groups];
    }

    function reset() {
        selected = undefined;
        onPerformSearch("");
    }

    function select(match: Match | undefined) {
        selected = match;
        results = [];
        if (match !== undefined) {
            if (match.isCommunity) {
                location = { kind: "community", communityId: match.id };
            } else {
                location = { kind: "group_chat", groupId: match.id };
            }
        }
    }
</script>

<div class="bot-install-location" class:showing-menu={results.length > 0}>
    <Legend
        label={i18nKey("bots.builder.testContext")}
        rules={i18nKey("bots.builder.testContextInfo")}></Legend>
    {#if selected !== undefined}
        <SelectedMatch onRemove={() => reset()} match={selected}></SelectedMatch>
    {:else}
        <Search inputStyle fill {placeholder} searching={false} {searchTerm} {onPerformSearch} />
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
                            <div class="details">
                                <div class="name">
                                    {match.name}
                                </div>
                                <div class="type">
                                    {#if match.isCommunity}
                                        Community
                                    {:else}
                                        Group chat
                                    {/if}
                                </div>
                            </div>
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        </div>
    {/if}

    <p class="info">
        <Translatable resourceKey={i18nKey("bots.builder.testContextExplanation")}></Translatable>
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

    .type {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }
</style>
