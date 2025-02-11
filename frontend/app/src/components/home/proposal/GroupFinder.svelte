<script lang="ts">
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Search from "../../Search.svelte";
    import { groupSearchState } from "../../../stores/search.svelte";
    import { getContext } from "svelte";
    import { AvatarSize, OpenChat, type GroupMatch } from "openchat-client";
    import SelectedMatch from "./SelectedMatch.svelte";
    import Avatar from "../../Avatar.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 15;

    interface Props {
        onSelect: (group: GroupMatch | undefined) => void;
        selected?: GroupMatch;
    }

    let { onSelect, selected }: Props = $props();

    function search(term: string) {
        if (term === "") {
            reset(true);
            return;
        }
        groupSearchState.term = term;
        groupSearchState.reset();

        client.searchGroups(groupSearchState.term, PAGE_SIZE).then((results) => {
            if (results.kind === "success") {
                groupSearchState.results = results.matches;
                groupSearchState.total = results.total;
            }
        });
    }

    function reset(clearSelected: boolean) {
        groupSearchState.results = [];
        groupSearchState.term = "";
        if (clearSelected) {
            select(undefined);
        }
    }

    function select(match: GroupMatch | undefined) {
        selected = match;
        groupSearchState.results = [];
        onSelect(match);
    }
</script>

<div class="finder">
    {#if selected !== undefined}
        <SelectedMatch onRemove={() => reset(true)} match={selected}></SelectedMatch>
    {:else}
        <Search
            fill
            bind:searchTerm={groupSearchState.term}
            searching={false}
            on:searchEntered={(ev: CustomEvent<string>) => search(ev.detail)}
            placeholder={i18nKey("searchGroupsPlaceholder")} />
    {/if}

    {#if groupSearchState.results.length > 0}
        <div class="menu">
            <Menu fit>
                {#each groupSearchState.results as group (group.chatId.groupId)}
                    <MenuItem onclick={() => select(group)}>
                        <Avatar
                            slot="icon"
                            url={client.groupAvatarUrl({
                                ...group,
                                id: group.chatId,
                            })}
                            size={AvatarSize.Small} />
                        <div slot="text">{group.name}</div>
                    </MenuItem>
                {/each}
            </Menu>
        </div>
    {/if}
</div>

<style lang="scss">
    .finder {
        margin-bottom: $sp3;
    }

    .menu {
        max-height: 250px;
        overflow: auto;
        width: fit-content;
        margin-top: $sp3;
    }
</style>
