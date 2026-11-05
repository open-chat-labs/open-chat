<script lang="ts">
    import type { OpenChat, UserOrUserGroup } from "@client";
    import {
        allUsersStore,
        currentUserIdStore,
        MAX_MENTION_CANDIDATES_SHOWN,
        mentionCandidateKey,
        mentionCandidates,
        selectedChatMembersStore,
        selectedCommunityMembersStore,
    } from "@client";
    import { getContext, type Snippet } from "svelte";
    import { MemberFinder } from "@src/logic/composer/composer";


    const client = getContext<OpenChat>("client");

    type Direction = "up" | "down";

    interface Props {
        prefix: string | undefined;
        offset?: number;
        direction?: Direction;
        border?: boolean;
        mentionSelf?: boolean;
        supportsUserGroups?: boolean;
        usersOnly?: boolean;
        inline?: boolean;
        onMention: (user: UserOrUserGroup) => void;
        children: Snippet<
            [
                (u: UserOrUserGroup) => string,
                (u: UserOrUserGroup) => void,
                UserOrUserGroup[],
                Direction,
                boolean,
                boolean,
                string,
                number,
                number,
            ]
        >;
    }

    let {
        prefix,
        offset = 0,
        direction = "up",
        border = false,
        mentionSelf = false,
        supportsUserGroups = false,
        usersOnly = false,
        inline = false,
        onMention,
        children,
    }: Props = $props();

    const index = $state(0);

    // Rebuilt when the members change, which they do when those which weren't held are found
    let usersAndGroups = $derived.by(() => {
        void [$selectedChatMembersStore, $selectedCommunityMembersStore, $allUsersStore];
        return Object.values(client.getUserLookupForMentions());
    });

    // A chat which holds only some of its members is searched for those matching what has been
    // typed
    const finder = new MemberFinder((searchFor) => client.findMembersToMention(searchFor));
    $effect(() => {
        finder.typed(prefix);
        return () => finder.cancel();
    });

    function mention(userOrGroup: UserOrUserGroup) {
        onMention($state.snapshot(userOrGroup));
    }

    const itemHeight = 48;
    const borderWidth = 0;
    let maxHeight = $derived<string>(
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)",
    );
    let filtered = $derived(
        mentionCandidates(usersAndGroups, prefix, {
            me: $currentUserIdStore,
            mentionSelf,
            supportsUserGroups,
            usersOnly,
            keepUserOrder: false,
        }).slice(0, MAX_MENTION_CANDIDATES_SHOWN),
    );
    let height = $derived(filtered.length * itemHeight + borderWidth);
    let style = $derived(
        direction === "up"
            ? `bottom: ${offset}px; height: ${height}px; max-height: ${maxHeight}`
            : `top: ${offset}px; height: ${height}px; max-height: ${maxHeight}`,
    );

    const userOrGroupKey = mentionCandidateKey;
</script>

{@render children(
    userOrGroupKey,
    mention,
    filtered,
    direction,
    inline,
    border,
    style,
    index,
    height,
)}
