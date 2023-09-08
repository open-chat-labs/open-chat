<script lang="ts">
    import { _ } from "svelte-i18n";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import type { CommunitySummary, OpenChat, UserGroupDetails } from "openchat-client";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { iconSize } from "../../../../stores/iconSize";
    import { getContext } from "svelte";
    import Search from "../../../Search.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import UserGroup from "./UserGroup.svelte";
    import { toastStore } from "../../../../stores/toast";

    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;

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

    function deleteUserGroup(userGroup: UserGroupDetails) {
        client.deleteUserGroup(community.id, userGroup).then((success) => {
            if (!success) {
                toastStore.showFailureToast($_("communities.errors.deleteUserGroupFailed"));
            }
        });
    }
</script>

{#if selectedGroup !== undefined}
    <UserGroup {community} on:cancel={() => (selectedGroup = undefined)} original={selectedGroup} />
{:else}
    <div class="user-groups">
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
                        <h4 class="name">
                            {userGroup.name}
                            <span class="count"
                                >{$_("communities.userGroupCount", {
                                    values: { count: userGroup.members.size.toLocaleString() },
                                })}</span>
                        </h4>
                        <div
                            on:click|stopPropagation={() => deleteUserGroup(userGroup)}
                            class="delete">
                            <DeleteOutline
                                viewBox={"0 -3 24 24"}
                                size={$iconSize}
                                color={"var(--icon-txt)"} />
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .search-row {
        display: flex;
        align-items: center;
        gap: $sp3;

        .search {
            flex: auto;
        }

        .add {
            flex: 0 0 30px;
        }
    }

    .user-groups {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        height: 100%;
        justify-content: space-between;

        .no-groups {
            padding: $sp4;
            @include font-size(fs-80);
            color: var(--txt-light);
        }

        .groups {
            flex: auto;
            border: 1px solid var(--bd);
            border-radius: $sp2;

            .user-group {
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: $sp4;
                transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
                gap: 12px;
                border-bottom: 1px solid var(--bd);

                &:last-child {
                    border-bottom: none;
                }

                @media (hover: hover) {
                    &:not(.me):hover {
                        background-color: var(--members-hv);
                    }
                }

                @include mobile() {
                    padding: $sp3 toRem(10);
                }

                .name {
                    flex: auto;
                    @include font(medium, normal, fs-100);
                    @include ellipsis();

                    .count {
                        margin-left: $sp2;
                        @include font-size(fs-70);
                        color: var(--txt-light);
                    }
                }

                .delete {
                    flex: 0 0 30px;
                    transition: opacity 250ms ease-in-out;
                    opacity: 0.6;
                }

                &:hover {
                    .delete {
                        opacity: 1;
                    }
                }
            }
        }
    }
</style>
