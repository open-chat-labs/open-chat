<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { OpenChat, UserGroupDetails } from "openchat-client";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { iconSize } from "../../../../stores/iconSize";
    import { getContext } from "svelte";
    import Search from "../../../Search.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import UserGroup from "./UserGroup.svelte";

    const client = getContext<OpenChat>("client");

    let searchTerm = "";
    let selectedGroup: UserGroupDetails | undefined = undefined;

    $: userGroups = client.currentCommunityUserGroups;

    $: matchingGroups = $userGroups.filter(matchesSearch);

    $: console.log("UserGroups: ", $userGroups);

    function matchesSearch(userGroup: UserGroupDetails): boolean {
        if (searchTerm === "") return true;
        return userGroup.name.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function createUserGroup() {
        selectedGroup = {
            id: -1,
            name: "",
            members: new Set<string>(),
        };
    }
</script>

{#if selectedGroup !== undefined}
    <UserGroup userGroup={selectedGroup} />
{:else}
    <div class="search-row">
        <div class="search">
            <Search fill searching={false} bind:searchTerm placeholder={"search"} />
        </div>
        <div class="add">
            <HoverIcon on:click={createUserGroup}>
                <Plus size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    </div>
    <div class="groups">
        {#if matchingGroups.length === 0}
            <div class="no-groups">
                {$_("communities.noUserGroups")}
            </div>
        {:else}
            {#each matchingGroups as userGroup}
                <div class="user-group" on:click={() => (selectedGroup = userGroup)}>
                    {userGroup.name}
                </div>
            {/each}
        {/if}
    </div>
{/if}

<style lang="scss">
    .search-row {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;

        .search {
            flex: auto;
        }

        .add {
            flex: 0 0 30px;
        }
    }

    .user-group {
        cursor: pointer;
    }
</style>
