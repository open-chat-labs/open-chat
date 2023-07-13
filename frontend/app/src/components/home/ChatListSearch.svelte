<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Search from "../Search.svelte";
    import type {
        ChannelMatch,
        ChatListScope,
        CommunityIdentifier,
        GroupSearchResponse,
        OpenChat,
        UserSummary,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let searchTerm: string = "";
    export let searchResultsAvailable: boolean = false;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let channelSearchResults: Promise<ChannelMatch[]> | undefined = undefined;

    let searching: boolean = false;

    $: chatListScope = client.chatListScope;
    $: placeholder = getPlaceholder($chatListScope.kind);

    onMount(() => {
        return chatListScope.subscribe((_) => clearSearch());
    });

    function getPlaceholder(scope: ChatListScope["kind"]): string {
        switch (scope) {
            case "community":
                return "searchChannelsPlaceholder";
            case "group_chat":
                return "searchGroupsPlaceholder";
            case "direct_chat":
                return "searchUsersPlaceholder";
            case "favourite":
                return "searchFavouritesPlaceholder";
            case "none":
                return "searchPlaceholder";
        }
    }

    function clearSearch() {
        searchTerm = "";
        searching = false;
        searchResultsAvailable = false;
        groupSearchResults = undefined;
        userSearchResults = undefined;
        channelSearchResults = undefined;
    }

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail;

        if (searchTerm !== "") {
            try {
                searching = true;
                const term = searchTerm.toLowerCase();
                switch ($chatListScope.kind) {
                    case "none":
                        legacySearch(term);
                        break;
                    case "group_chat":
                        groupSearch(term);
                        break;
                    case "direct_chat":
                        userSearch(term);
                        break;
                    case "community":
                        channelSearch($chatListScope.id, term);
                }
            } catch (err) {
                console.warn("search failed with: ", err);
                searching = false;
            } finally {
                searching = false;
            }
        } else {
            clearSearch();
        }
    }

    function postSearch() {
        if (searchTerm !== "") {
            searchResultsAvailable = true;
        } else {
            clearSearch();
        }
    }

    async function userSearch(term: string) {
        userSearchResults = client.searchUsers(term, 10);
        await userSearchResults.then(postSearch);
    }

    async function groupSearch(term: string) {
        groupSearchResults = client.searchGroups(term, 10);
        await groupSearchResults.then(postSearch);
    }

    async function channelSearch(id: CommunityIdentifier, term: string) {
        channelSearchResults = client
            .exploreChannels(id, term, 0, 10)
            .then((res) => (res.kind === "success" ? res.matches : []));
        await channelSearchResults.then(postSearch);
    }

    async function legacySearch(term: string) {
        groupSearchResults = client.searchGroups(term, 10);
        userSearchResults = client.searchUsers(term, 10);
        await Promise.all([groupSearchResults, userSearchResults]).then(postSearch);
    }
</script>

<Search
    id={"chat-list-search"}
    {placeholder}
    {searching}
    {searchTerm}
    on:searchEntered={performSearch} />
