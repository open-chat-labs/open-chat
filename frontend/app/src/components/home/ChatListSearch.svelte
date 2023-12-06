<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Search from "../Search.svelte";
    import type {
        ChatListScope,
        GroupSearchResponse,
        OpenChat,
        UserSummary,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let searchTerm: string = "";
    export let searchResultsAvailable: boolean = false;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;

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

    async function legacySearch(term: string) {
        groupSearchResults = client.searchGroups(term, 10);
        userSearchResults = client.searchUsers(term, 10);
        await Promise.all([groupSearchResults, userSearchResults]).then(postSearch);
    }
</script>

<Search {placeholder} {searching} {searchTerm} on:searchEntered={performSearch} />
