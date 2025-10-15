<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container, ListAction } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        compareChats,
        OpenChat,
        publish,
        serverDirectChatsStore,
        type BotMatch,
        type GroupSearchResponse,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiplePlusOutline from "svelte-material-icons/AccountMultiplePlusOutline.svelte";
    import MatchingUser from "../MatchingUser.svelte";
    import Translatable from "../Translatable.svelte";
    import ChatListSearch from "./ChatListSearch.svelte";
    import { updateGroupState } from "./createOrUpdateGroup/group.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let userAndBotSearchResults: Promise<(UserSummary | BotMatch)[]> | undefined =
        $state(undefined);
    let groupSearchResults: Promise<GroupSearchResponse> | undefined = $state(undefined);
    let searchTerm: string = $state("");
    let searchResultsAvailable: boolean = $state(false);

    let dms = $derived(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .map((c) => $allUsersStore.get(c.them.userId))
            .filter((u) => u?.kind !== "bot")
            .slice(0, 30),
    );

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
</script>

{#snippet matched_user(user: UserSummary | BotMatch)}
    <MatchingUser {searchTerm} {user} onSelect={directChatWith} />
{/snippet}

<SlidingPageContent title={i18nKey("New message")}>
    <Container
        padding={["zero", "lg", "zero", "lg"]}
        width={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        height={{ kind: "hug" }}>
        <ChatListSearch
            bind:userAndBotsSearchResults={userAndBotSearchResults}
            bind:groupSearchResults
            bind:searchResultsAvailable
            bind:searchTerm />

        {#if userAndBotSearchResults !== undefined}
            {#await userAndBotSearchResults then resp}
                {#if resp.length > 0}
                    <Container direction={"vertical"} padding={["zero", "md"]}>
                        {#each resp as match, i (userOrBotKey(match))}
                            {@render matched_user(match)}
                        {/each}
                    </Container>
                {/if}
            {/await}
        {/if}
        <Container
            width={{ kind: "fill" }}
            gap={"lg"}
            padding={["zero", "md"]}
            direction={"vertical"}
            height={{ kind: "hug" }}>
            <ListAction onClick={newGroup}>
                {#snippet icon(color)}
                    <AccountMultiplePlusOutline {color} />
                {/snippet}
                Create new group
            </ListAction>
        </Container>

        {#if dms.length > 0}
            <Container padding={["zero", "md"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Frequently contacted on OpenChat")}
                    ></Translatable>
                </Body>

                {#each dms as user (user?.userId)}
                    {#if user}
                        {@render matched_user(user)}
                    {/if}
                {/each}
            </Container>
        {/if}
    </Container>
</SlidingPageContent>
