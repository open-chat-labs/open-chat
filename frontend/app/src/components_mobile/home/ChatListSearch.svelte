<script lang="ts">
    import { Search } from "component-lib";
    import {
        chatListScopeStore,
        chatListSearchMatches,
        type BotMatch,
        type ChatListScope,
        type GroupMatch,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm?: string;
        searchResultsAvailable: boolean;
        groupSearchResults?: Promise<GroupMatch[]> | undefined;
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

    async function searchQuery(term: string) {
        // people, then bots that take direct chats, and the public groups (the client's
        // searchChatList): the groups arrive on their own, as the people and bots do
        const found = client.searchChatList(term, { groups: true });
        groupSearchResults = found.groups;
        userAndBotsSearchResults = Promise.all([found.users, found.bots]).then(([users, bots]) =>
            chatListSearchMatches({ users, bots }),
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
