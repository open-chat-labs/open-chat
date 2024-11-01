<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Search from "../Search.svelte";
    import type {
        ChatListScope,
        GroupSearchResponse,
        OpenChat,
        ResourceKey,
        UserSummary,
    } from "openchat-client";
    import { chatListScopeStore as chatListScope } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let searchTerm: string = "";
    export let searchResultsAvailable: boolean = false;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;

    let searching: boolean = false;

    $: placeholder = getPlaceholder($chatListScope.kind);

    onMount(() => {
        return chatListScope.subscribe((_) => clearSearch());
    });

    $: {
        if (searchTerm === "") {
            searching = false;
            searchResultsAvailable = false;
            groupSearchResults = undefined;
            userSearchResults = undefined;
        }
    }

    function getPlaceholder(scope: ChatListScope["kind"]): ResourceKey {
        switch (scope) {
            case "community":
                return i18nKey("searchChannelsPlaceholder");
            case "group_chat":
                return i18nKey("searchGroupsPlaceholder");
            case "direct_chat":
                return i18nKey("searchUsersPlaceholder");
            case "favourite":
                return i18nKey("searchFavouritesPlaceholder");
            case "none":
                return i18nKey("searchPlaceholder");
        }
    }

    function clearSearch() {
        searchTerm = "";
    }

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail;

        if ($chatListScope.kind === "direct_chat") {
            searchTerm = trimLeadingAtSymbol(searchTerm);
        }

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
