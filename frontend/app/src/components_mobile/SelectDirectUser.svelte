<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, Option, Search, Select, Subtitle } from "component-lib";
    import {
        allUsersStore,
        compareChats,
        serverDirectChatsStore,
        type UserSummary,
    } from "openchat-client";
    import { type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "./Translatable.svelte";
    import User from "./home/User.svelte";

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
    <User profile={false} {searchTerm} onClick={() => internalSelect(user)} {user} />
{/snippet}

<Select {disabled} {subtext} onSelect={internalSelect} {placeholder} value={selected}>
    {#snippet selectedValue(val)}
        @{val.username}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Container
            onClick={(e) => e?.stopPropagation()}
            height={{ size: "100%" }}
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
