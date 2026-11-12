<script lang="ts">
    import {
        chatListScopeStore,
        chatListSearchMatches,
        chatListSearchResults,
        type BotMatch,
        type ChatListScope,
        type GroupSearchResponse,
        type OpenChat,
        type ResourceKey,
        type UserSummary,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../utils/user";
    import Search from "../Search.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm: string;
        searchResultsAvailable: boolean;
        groupSearchResults?: Promise<GroupSearchResponse> | undefined;
        userAndBotsSearchResults?: Promise<(UserSummary | BotMatch)[]> | undefined;
    }

    let {
        searchTerm = $bindable(""),
        searchResultsAvailable = $bindable(false),
        groupSearchResults = $bindable(undefined),
        userAndBotsSearchResults = $bindable(undefined),
    }: Props = $props();

    let searching: boolean = $state(false);

    $effect(() => {
        void $chatListScopeStore.kind;
        clearSearch();
    });

    function getPlaceholder(scope: ChatListScope["kind"]): ResourceKey {
        switch (scope) {
            case "community":
                return i18nKey("searchChannelsPlaceholder");
            case "chats":
                return i18nKey("search");
            case "favourite":
                return i18nKey("searchFavouritesPlaceholder");
            case "none":
                return i18nKey("searchPlaceholder");
        }
    }

    function clearSearch() {
        searchTerm = "";
    }

    async function performSearch(term: string) {
        searchResultsAvailable = false;
        searchTerm = term;

        searchTerm = trimLeadingAtSymbol(searchTerm);

        if (searchTerm !== "") {
            try {
                searching = true;
                const term = searchTerm.toLowerCase();
                switch ($chatListScopeStore.kind) {
                    case "none":
                        legacySearch(term);
                        break;
                    case "chats":
                        userAndBotSearch(term);
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

    // people, then bots that take direct chats (the client's searchChatList)
    async function userAndBotSearch(term: string) {
        userAndBotsSearchResults = chatListSearchResults(client.searchChatList(term)).then(
            chatListSearchMatches,
        );
        await userAndBotsSearchResults.then(postSearch);
    }

    async function legacySearch(term: string) {
        groupSearchResults = client.searchGroups(term, 10);
        userAndBotsSearchResults = client.searchUsers(term, 10);
        Promise.all([groupSearchResults, userAndBotsSearchResults]).then(postSearch);
    }
    let placeholder = $derived(getPlaceholder($chatListScopeStore.kind));
    $effect(() => {
        if (searchTerm === "") {
            searching = false;
            searchResultsAvailable = false;
            groupSearchResults = undefined;
            userAndBotsSearchResults = undefined;
        }
    });
</script>

<Search {placeholder} {searching} {searchTerm} onPerformSearch={performSearch} />
