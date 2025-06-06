<script lang="ts">
    import {
        chatListScopeStore,
        currentUserIdStore,
        type BotMatch,
        type ChatListScope,
        type DirectChatIdentifier,
        type GroupSearchResponse,
        type OpenChat,
        type ResourceKey,
        type UserSummary,
    } from "openchat-client";
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

    searchResultsAvailable;

    let searching: boolean = $state(false);

    $effect(() => {
        void $chatListScopeStore.kind;
        clearSearch();
    });

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

    async function performSearch(term: string) {
        searchResultsAvailable = false;
        searchTerm = term;

        if ($chatListScopeStore.kind === "direct_chat") {
            searchTerm = trimLeadingAtSymbol(searchTerm);
        }

        if (searchTerm !== "") {
            try {
                searching = true;
                const term = searchTerm.toLowerCase();
                switch ($chatListScopeStore.kind) {
                    case "none":
                        legacySearch(term);
                        break;
                    case "group_chat":
                        groupSearch(term);
                        break;
                    case "direct_chat":
                        userAndBotSearch(term);
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

    function sortUsersOrBots(_a: UserSummary | BotMatch, _b: UserSummary | BotMatch): number {
        return 0;
    }

    async function userAndBotSearch(term: string) {
        userAndBotsSearchResults = Promise.all([searchUsers(term), searchBots(term)]).then(
            ([users, bots]) => [...users, ...bots].sort(sortUsersOrBots),
        );
        await userAndBotsSearchResults.then(postSearch);
    }

    function searchBots(term: string): Promise<BotMatch[]> {
        // This location is rather hacky because we can't have a direct chat with ourselves
        // but it signals to the explore_bots endpoint that we want to see bots that are
        // available for direct chat.
        const location = {
            kind: "direct_chat",
            userId: $currentUserIdStore,
        } as DirectChatIdentifier;

        return client.exploreBots(term, 0, 10, location, false).then((result) => {
            return result.kind === "success" ? result.matches : [];
        });
    }

    function searchUsers(term: string): Promise<UserSummary[]> {
        return client.searchUsers(term, 10);
    }

    async function groupSearch(term: string) {
        groupSearchResults = client.searchGroups(term, 10);
        groupSearchResults.then(postSearch);
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
