<script lang="ts">
    import { _ } from "svelte-i18n";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import AreYouSure from "../../../AreYouSure.svelte";
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
    let confirmingDelete = false;
    let groupToDelete: UserGroupDetails | undefined = undefined;

    $: userStore = client.userStore;
    $: communityMembers = client.currentCommunityMembers;
    $: userGroupsMap = client.currentCommunityUserGroups;
    $: userGroups = [...$userGroupsMap.values()];
    $: canManageUserGroups = client.canManageUserGroups(community.id);

    $: matchingGroups = userGroups.filter(matchesSearch);

    function matchesSearch(userGroup: UserGroupDetails): boolean {
        if (searchTerm === "") return true;
        return userGroup.name.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function createUserGroup() {
        selectedGroup = {
            kind: "user_group",
            id: -1,
            name: "",
            members: new Set<string>(),
        };
    }

    function deleteUserGroup(yes: boolean = true): Promise<void> {
        if (confirmingDelete && !yes) {
            groupToDelete = undefined;
            confirmingDelete = false;
            return Promise.resolve();
        }
        if (groupToDelete === undefined) {
            return Promise.resolve();
        }

        confirmingDelete = false;

        return client
            .deleteUserGroup(community.id, groupToDelete)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast($_("communities.errors.deleteUserGroupFailed"));
                }
            })
            .finally(() => (groupToDelete = undefined));
    }

    function confirmDeleteUserGroup(userGroup: UserGroupDetails) {
        groupToDelete = userGroup;
        confirmingDelete = true;
    }

    export function reset() {
        selectedGroup = undefined;
    }
</script>

{#if confirmingDelete}
    <AreYouSure message={$_("communities.confirmDeleteUserGroup")} action={deleteUserGroup} />
{/if}

{#if selectedGroup !== undefined}
    <UserGroup
        {canManageUserGroups}
        {community}
        communityMembers={$communityMembers}
        userStore={$userStore}
        on:cancel={() => (selectedGroup = undefined)}
        original={selectedGroup} />
{:else}
    <div class="user-groups">
        <div class="search-row">
            <div class="search">
                <Search fill searching={false} bind:searchTerm placeholder={"search"} />
            </div>
            {#if canManageUserGroups}
                <div class="add">
                    <HoverIcon on:click={createUserGroup}>
                        <Plus size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
            {/if}
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
                            <span class="name-text">{userGroup.name}</span>
                            <span class="members">
                                <span class="num">{userGroup.members.size.toLocaleString()}</span>
                                {$_("members")}
                            </span>
                        </h4>
                        {#if canManageUserGroups}
                            <div
                                on:click|stopPropagation={() => confirmDeleteUserGroup(userGroup)}
                                class="delete">
                                <DeleteOutline
                                    viewBox={"0 -3 24 24"}
                                    size={$iconSize}
                                    color={"var(--icon-txt)"} />
                            </div>
                        {/if}
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
        padding: 0 $sp4;

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
        gap: toRem(12);
        height: 100%;
        justify-content: space-between;

        .no-groups {
            padding: $sp4;
            @include font-size(fs-80);
            color: var(--txt-light);
        }

        .groups {
            flex: auto;

            .user-group {
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: toRem(12) $sp4;
                transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
                gap: 12px;

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

                    .name-text {
                        display: inline-block;
                        padding: toRem(6);
                        background-color: rgba(0, 0, 0, 0.05);
                        border-radius: $sp3;
                    }

                    .members {
                        @include font-size(fs-70);
                        margin-left: $sp2;
                        color: var(--txt-light);
                        .num {
                            color: var(--txt);
                            font-weight: 700;
                        }
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
