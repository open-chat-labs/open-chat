<script lang="ts">
    import { Search } from "component-lib";
    import {
        chatListScopeStore,
        currentUserIdStore,
        type BotMatch,
        type ChatListScope,
        type DirectChatIdentifier,
        type GroupSearchResponse,
        type OpenChat,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm?: string;
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

    function getPlaceholder(scope: ChatListScope["kind"]): string {
        switch (scope) {
            case "community":
                return interpolate($_, i18nKey("searchChannelsPlaceholder"));
            case "chats":
                return interpolate($_, i18nKey("search"));
            case "favourite":
                return interpolate($_, i18nKey("searchFavouritesPlaceholder"));
            case "none":
                return interpolate($_, i18nKey("searchPlaceholder"));
        }
    }

    function clearSearch() {
        searchTerm = "";
    }

    async function performSearch(term?: string) {
        if (term === undefined || term === "") return;
        searchResultsAvailable = false;
        searchTerm = term;

        searchTerm = trimLeadingAtSymbol(searchTerm);

        if (searchTerm !== "") {
            try {
                searching = true;
                const term = searchTerm.toLowerCase();
                searchQuery(term);
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

    async function searchQuery(term: string) {
        groupSearchResults = client.searchGroups(term, 10).then((res) => {
            console.log(res);
            return res;
        });
        userAndBotsSearchResults = Promise.all([searchUsers(term), searchBots(term)]).then(
            ([users, bots]) => [...users, ...bots].sort(sortUsersOrBots),
        );
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

<Search
    onClear={() => (searchTerm = "")}
    {placeholder}
    {searching}
    value={searchTerm}
    onSearch={performSearch} />
