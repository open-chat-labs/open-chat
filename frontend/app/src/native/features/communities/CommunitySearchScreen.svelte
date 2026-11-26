<!-- A community's search (its details' Search tile): the Chats tab's search (ChatSearch) over the
     community's channels: the user's, matched by name as they type, and those they're not in that
     they can read, found by the community (the client's exploreChannels, as the old desktop's
     Browse channels and the community page's "Not joined" rows). A tap opens the channel (one not
     joined opens to read, with the join bar); Cancel goes back. The app has no search of a
     community's messages, so it searches channels only. -->
<script lang="ts">
    import {
        allChatsStore,
        chatsInScope,
        communitiesStore,
        favouritesStore,
        routeForChatIdentifier,
        type ChannelMatch,
        type OpenChat,
    } from "@client";
    import { searchTerm } from "@src/logic/chats/chatSearch";
    import { TermSearch } from "@src/logic/chats/termSearch.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import ChatSearch, { type SearchSection } from "../chats/ChatSearch.svelte";
    import {
        channelKey,
        communitySearchSections,
        joinedChannelRows,
        otherChannelRows,
    } from "./communitySearch.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "community_search" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const communityId = untrack(() => screen.communityId);
    const community = $derived($communitiesStore.get(communityId));

    let query = $state("");
    let expanded = $state<Record<string, boolean>>({});
    const term = $derived(searchTerm(query));

    // the user's channels in it, as the community page lists them
    const joined = $derived(
        [...chatsInScope({ kind: "community", id: communityId }, $allChatsStore, $favouritesStore).values()]
            .flatMap((c) => (c.kind === "channel" ? [c] : [])),
    );
    const joinedKeys = $derived(new Set(joined.map((c) => channelKey(c.id))));

    // the community's channels found for the term (its first 50, as many as a search shows)
    const found = new TermSearch<ChannelMatch[]>(async (t) => {
        const response = await client.exploreChannels(
            { kind: "community", communityId: communityId.communityId },
            t,
            0,
            50,
        );
        return response.kind === "success" ? response.matches : [];
    });
    onDestroy(() => found.dispose());

    function onQuery(next: string) {
        query = next;
        expanded = {};
        found.set(searchTerm(next));
    }

    const members = (count: number) =>
        $_("native.community.preview.channelMembers", { values: { count } });

    const foundChannels = $derived.by((): ChannelMatch[] => {
        const results = found.results;
        return results.kind === "found" && results.term === term ? results.found : [];
    });

    const rows = $derived({
        joined: joinedChannelRows(joined, term, members),
        others: otherChannelRows(
            foundChannels,
            { has: (id) => joinedKeys.has(channelKey(id)) },
            term,
            members,
        ),
    });

    const LABELS = {
        joined: "native.communitySearch.joined",
        others: "native.communitySearch.others",
    } as const;

    const sections = $derived<SearchSection[]>(
        communitySearchSections(rows, expanded).map(({ id, section }) => ({
            id,
            label: `${$_(LABELS[id])} · ${section.total}`,
            rows: section.rows,
            more: section.more,
            expanded: expanded[id] ?? false,
        })),
    );

    const text = $derived({
        placeholder: $_("native.communitySearch.placeholder", {
            values: { name: community?.name ?? "" },
        }),
        cancel: $_("cancel"),
        clear: $_("native.chats.search.clear"),
        searchFor: $_("native.chats.search.searchFor"),
        kinds: [{ label: $_("native.community.manage.channels"), icon: "hash" }],
        showAll: $_("native.chats.search.showAll"),
        showLess: $_("native.chats.search.showLess"),
        noResults: $_("native.chats.search.noResults", { values: { query: query.trim() } }),
        noResultsHint: $_("native.communitySearch.noResultsHint"),
    });

    function onSelect(_section: string, rowId: string) {
        const channel =
            joined.find((c) => channelKey(c.id) === rowId) ??
            foundChannels.find((c) => channelKey(c.id) === rowId);
        if (channel !== undefined) navigate(routeForChatIdentifier("community", channel.id));
    }
</script>

<div class="community-search">
    <ChatSearch
        open
        {query}
        {sections}
        searching={term !== "" && found.results.kind === "searching"}
        {text}
        {onQuery}
        onCancel={() => context.back?.()}
        onToggle={(id) => (expanded = { ...expanded, [id]: !(expanded[id] ?? false) })}
        {onSelect} />
</div>

<style lang="scss">
    .community-search {
        position: relative;
        height: 100%;
        min-height: 0;
    }
</style>
