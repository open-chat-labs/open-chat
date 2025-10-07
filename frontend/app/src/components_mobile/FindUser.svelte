<script lang="ts">
    import { Body, Container, Label, Search } from "component-lib";
    import {
        allUsersStore,
        compareChats,
        serverDirectChatsStore,
        type UserSummary,
    } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import { toastStore } from "../stores/toast";
    import MatchingUser from "./MatchingUser.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
        placeholderKey?: string;
        onSelectUser?: (user: UserSummary) => void;
        selected?: Snippet;
        selectedUsers?: UserSummary[];
    }

    let {
        userLookup,
        placeholderKey = "searchForUsername",
        onSelectUser,
        selected,
        selectedUsers = [],
    }: Props = $props();

    let searchTerm: string = $state("");
    let communityMembers: UserSummary[] = $state([]);
    let users: UserSummary[] = $state([]);
    let searching: boolean = $state(false);
    let selectedSet = $derived(new Set(selectedUsers.map((u) => u.userId)));

    function onSelect(user: UserSummary) {
        onSelectUser?.(user);
    }

    function searchUsers(value?: string) {
        if (value === "" || value === undefined) {
            users = [];
            return;
        }
        searching = true;
        userLookup(value)
            .then((p) => {
                communityMembers = p[0];
                users = p[1];
            })
            .catch((_err) => toastStore.showFailureToast(i18nKey("userSearchFailed")))
            .finally(() => (searching = false));
    }

    function clearFilter() {
        users = [];
        searchTerm = "";
    }

    let dms = $derived(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .map((c) => $allUsersStore.get(c.them.userId))
            .filter((u) => u?.kind !== "bot")
            .slice(0, 30),
    );
</script>

<Container gap={"lg"} direction={"vertical"}>
    <Search
        {searching}
        id={"search_component"}
        onSearch={(v) => searchUsers(v)}
        onClear={clearFilter}
        placeholder={$_(placeholderKey)}
        bind:value={searchTerm} />

    {@render selected?.()}
</Container>

{#snippet match(user: UserSummary)}
    <MatchingUser checked={selectedSet.has(user.userId)} {searchTerm} {user} {onSelect} />
{/snippet}

{#if communityMembers?.length > 0 || users?.length > 0}
    <Container direction={"vertical"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Search results")}></Translatable>
        </Body>

        {#if communityMembers?.length > 0}
            <Label colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("communityMembers")} />
            </Label>
            {#each communityMembers as user (user.userId)}
                {@render match(user)}
            {/each}
        {/if}
        {#if communityMembers?.length > 0 && users?.length > 0}
            <Label colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("otherUsers")} />
            </Label>
        {/if}
        {#each users as user (user.userId)}
            {@render match(user)}
        {/each}
    </Container>
{/if}

{#if dms.length > 0}
    <Container direction={"vertical"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Frequently contacted on OpenChat")}></Translatable>
        </Body>

        {#each dms as user (user?.userId)}
            {#if user}
                {@render match(user)}
            {/if}
        {/each}
    </Container>
{/if}
