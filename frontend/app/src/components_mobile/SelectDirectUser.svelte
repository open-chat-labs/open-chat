<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Avatar, BodySmall, Container, Option, Search, Select, Subtitle } from "component-lib";
    import {
        allUsersStore,
        compareChats,
        currentUserIdStore,
        OpenChat,
        serverDirectChatsStore,
        type UserSummary,
    } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import FilteredUsername from "./FilteredUsername.svelte";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        disabled?: boolean;
        selected?: UserSummary;
        subtext: Snippet;
        placeholder: string;
        onSelect: (val: UserSummary) => void;
    }

    let { subtext, onSelect, placeholder, selected, disabled = false }: Props = $props();
    let searching = $state(false);
    let searchTerm = $state<string>();

    let dms = $derived(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .map((c) => $allUsersStore.get(c.them.userId))
            .filter((u) => u?.kind !== "bot" && matchesSearchTerm(u!)),
    );

    function matchesSearchTerm(user: UserSummary) {
        if (searchTerm === undefined || searchTerm === "") return true;
        return (
            user.username.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()) ||
            user.displayName?.includes(searchTerm.toLocaleLowerCase())
        );
    }

    function internalSelect(val: UserSummary) {
        searchTerm = undefined;
        onSelect(val);
    }
</script>

{#snippet match(user: UserSummary)}
    <Container crossAxisAlignment={"center"} gap={"md"} onClick={() => internalSelect(user)}>
        <Avatar size={"md"} url={client.userAvatarUrl(user)} />
        <Container direction={"vertical"}>
            <Container crossAxisAlignment={"center"} gap={"xs"}>
                <FilteredUsername
                    {searchTerm}
                    me={user.kind === "user" && user.userId === $currentUserIdStore}
                    username={user.username} />
            </Container>
            <BodySmall colour={"textSecondary"}>
                <FilteredUsername {searchTerm} username={user.username} />
            </BodySmall>
        </Container>
    </Container>
{/snippet}

<Select {disabled} {subtext} onSelect={internalSelect} {placeholder} value={selected}>
    {#snippet selectedValue(val)}
        @{val.username}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Container
            onClick={(e) => e?.stopPropagation()}
            height={{ kind: "fixed", size: "100%" }}
            supplementalClass={"language_options"}
            padding={"lg"}
            gap={"lg"}
            direction={"vertical"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select user")}></Translatable>
            </Subtitle>

            <Search
                {searching}
                id={"search_component"}
                placeholder={$_("search")}
                bind:value={searchTerm} />

            <Container direction={"vertical"}>
                {#each dms as user (user?.userId)}
                    {#if user}
                        <Option
                            padding={["sm", "md", "sm", "sm"]}
                            value={user}
                            onClick={onSelect}
                            selected={selected?.userId === user.userId}>
                            {@render match(user)}
                        </Option>
                    {/if}
                {/each}
            </Container>
        </Container>
    {/snippet}
</Select>
