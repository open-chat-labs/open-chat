<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Avatar, Body, BodySmall, Column, Container, ListAction, Row } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        chatListScopeStore,
        compareChats,
        OpenChat,
        publish,
        routeForChatIdentifier,
        serverDirectChatsStore,
        serverGroupChatsStore,
        type BotMatch,
        type GroupChatSummary,
        type GroupMatch,
        type GroupSearchResponse,
        type UserSummary,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import AccountMultiplePlusOutline from "svelte-material-icons/AccountMultiplePlusOutline.svelte";
    import FilteredUsername from "../FilteredUsername.svelte";
    import MatchingUser from "../MatchingUser.svelte";
    import Translatable from "../Translatable.svelte";
    import ChatListSearch from "./ChatListSearch.svelte";
    import { updateGroupState } from "./createOrUpdateGroup/group.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let userAndBotsSearchResults: Promise<(UserSummary | BotMatch)[]> | undefined =
        $state(undefined);
    let groupSearchResults: Promise<GroupSearchResponse> | undefined = $state(undefined);
    let searchTerm: string = $state("");
    let searchTermLower = $derived(searchTerm.toLocaleLowerCase());
    let searchResultsAvailable: boolean = $state(false);

    let dms = $derived(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .map((c) => $allUsersStore.get(c.them.userId))
            .filter((u) => u?.kind !== "bot" && userMatches(u))
            .slice(0, 30),
    );

    let myGroups = $derived(
        [...$serverGroupChatsStore.values()].sort(compareChats).filter(groupMatches).slice(0, 30),
    );

    function userMatches(user?: UserSummary): boolean {
        return (
            user !== undefined &&
            (searchTermLower === "" ||
                user.username.toLocaleLowerCase().includes(searchTermLower) ||
                (user.displayName !== undefined &&
                    user.displayName.toLocaleLowerCase().includes(searchTermLower)))
        );
    }

    function groupMatches(group: GroupChatSummary): boolean {
        return searchTermLower === "" || group.name.toLocaleLowerCase().includes(searchTermLower);
    }

    function newGroup() {
        if ($anonUserStore) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_group" },
            });
        } else {
            updateGroupState.initialise(client.createCandidateGroup("group", false));
            publish("newGroup");
        }
    }

    function userOrBotKey(match: UserSummary | BotMatch): string {
        switch (match.kind) {
            case "bot_match":
                return match.id;
            default:
                return match.userId;
        }
    }

    function directChatWith(user: UserSummary | BotMatch) {
        publish("chatWith", {
            kind: "direct_chat",
            userId: user.kind === "bot_match" ? user.id : user.userId,
        });
        publish("closeModalStack");
    }

    function selectGroup(match: GroupMatch | GroupChatSummary) {
        const id = match.kind === "group_chat" ? match.id : match.chatId;
        page(routeForChatIdentifier($chatListScopeStore.kind, id));
        publish("closeModalStack");
    }
</script>

{#snippet matched_user(user: UserSummary | BotMatch)}
    <MatchingUser {searchTerm} {user} onSelect={directChatWith} />
{/snippet}

{#snippet matched_group(match: GroupMatch | GroupChatSummary)}
    {@const id = match.kind === "group_chat" ? match.id : match.chatId}
    {@const isPublic = match.kind === "group_chat" ? match.public : true}
    <Container
        padding={["sm", "zero"]}
        crossAxisAlignment={"center"}
        gap={"lg"}
        onClick={() => selectGroup(match)}>
        <Avatar
            size={"md"}
            url={client.groupAvatarUrl({
                ...match,
                id,
            })} />
        <Container direction={"vertical"}>
            <Row gap={"xs"} crossAxisAlignment={"center"}>
                <FilteredUsername {searchTerm} username={match.name} />
            </Row>
            <BodySmall colour={"textSecondary"}>
                {#if match.description !== ""}
                    {match.description}
                {:else if isPublic}
                    <Translatable resourceKey={i18nKey("Public group")} />
                {:else}
                    <Translatable resourceKey={i18nKey("Private group")} />
                {/if}
            </BodySmall>
        </Container>
    </Container>
{/snippet}

<SlidingPageContent title={i18nKey("New message")}>
    <Column padding={["xxl", "lg"]} width={"fill"} gap={"xxl"} height={"hug"}>
        <ChatListSearch
            bind:userAndBotsSearchResults
            bind:groupSearchResults
            bind:searchResultsAvailable
            bind:searchTerm />

        {#if userAndBotsSearchResults !== undefined}
            {#await userAndBotsSearchResults then resp}
                {#if resp.length > 0}
                    <Column padding={["zero", "md"]} gap={"lg"}>
                        <Body fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Matching users and bots")} />
                        </Body>
                        <Column gap={"sm"}>
                            {#each resp as match (userOrBotKey(match))}
                                {@render matched_user(match)}
                            {/each}
                        </Column>
                    </Column>
                {/if}
            {/await}
        {/if}

        {#if groupSearchResults !== undefined}
            {#await groupSearchResults then resp}
                {#if resp.kind === "success"}
                    {#if resp.matches.length > 0}
                        <Column padding={["zero", "md"]} gap={"lg"}>
                            <Body fontWeight={"bold"}>
                                <Translatable resourceKey={i18nKey("Matching public groups")} />
                            </Body>
                            <Column gap={"sm"}>
                                {#each resp.matches as match (match.chatId.groupId)}
                                    {@render matched_group(match)}
                                {/each}
                            </Column>
                        </Column>
                    {/if}
                {/if}
            {/await}
        {/if}

        <Container
            width={"fill"}
            gap={"lg"}
            padding={["zero", "md"]}
            direction={"vertical"}
            height={"hug"}>
            <ListAction onClick={newGroup}>
                {#snippet icon(color)}
                    <AccountMultiplePlusOutline {color} />
                {/snippet}
                Create new group
            </ListAction>
        </Container>

        {#if dms.length > 0}
            <Column padding={["zero", "md"]} gap={"lg"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Frequently contacted on OpenChat")}
                    ></Translatable>
                </Body>

                <Column gap={"sm"}>
                    {#each dms as user (user?.userId)}
                        {#if user}
                            {@render matched_user(user)}
                        {/if}
                    {/each}
                </Column>
            </Column>
        {/if}

        {#if myGroups.length > 0}
            <Column padding={["zero", "md"]} gap={"lg"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("My group chats")}></Translatable>
                </Body>

                <Column gap={"sm"}>
                    {#each myGroups as group (group.id.groupId)}
                        {@render matched_group(group)}
                    {/each}
                </Column>
            </Column>
        {/if}
    </Column>
</SlidingPageContent>
