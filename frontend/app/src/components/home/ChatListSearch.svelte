<script lang="ts">
    import {
        chatListScopeStore,
        chatListSearchMatches,
        type BotMatch,
        type ChatListScope,
        type ChatListSearch,
        type GroupMatch,
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
                        chatsSearch(term);
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

    // people, then bots that take direct chats, and the public groups (the client's
    // searchChatList): the groups arrive on their own, as the people and bots do
    async function chatsSearch(term: string) {
        const found = client.searchChatList(term, { groups: true });
        groupSearchResults = asGroupSearchResponse(found.groups);
        userAndBotsSearchResults = usersAndBots(found);
        await Promise.all([groupSearchResults, userAndBotsSearchResults]);
        postSearch();
    }

    // the people and bots, without waiting for the groups
    async function usersAndBots(found: ChatListSearch): Promise<(UserSummary | BotMatch)[]> {
        const [users, bots] = await Promise.all([found.users, found.bots]);
        return chatListSearchMatches({ users, bots });
    }

    // the public groups as the chat list's "Public groups" section takes them
    async function asGroupSearchResponse(
        groups: Promise<GroupMatch[]>,
    ): Promise<GroupSearchResponse> {
        const matches = await groups;
        return { kind: "success", matches, total: matches.length };
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
