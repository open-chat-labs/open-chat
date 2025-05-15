<script lang="ts">
    import type {
        CommunitySummary,
        Member,
        OpenChat,
        ReadonlyMap,
        UserGroupDetails,
        UserLookup,
        UserSummary,
    } from "openchat-client";
    import { app, iconSize, userStore } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey } from "../../../../i18n/i18n";
    import { toastStore } from "../../../../stores/toast";
    import AreYouSure from "../../../AreYouSure.svelte";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import Search from "../../../Search.svelte";
    import Translatable from "../../../Translatable.svelte";
    import User from "../../groupdetails/User.svelte";
    import UserGroup from "./UserGroup.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        openedGroupId?: number | undefined;
    }

    let { community, openedGroupId = $bindable(undefined) }: Props = $props();

    let searchTerm = $state("");
    let selectedGroup: UserGroupDetails | undefined = $state(undefined);
    let confirmingDelete = $state(false);
    let groupToDelete: UserGroupDetails | undefined = undefined;
    let communityUsers: Record<string, UserSummary> = $state({});
    let communityUsersList: UserSummary[] = $state([]);

    onMount(() => {
        communityUsers = createLookup(app.selectedCommunity.members, userStore.allUsers);
        communityUsersList = Object.values(communityUsers);
    });

    function createLookup(
        members: ReadonlyMap<string, Member>,
        allUsers: UserLookup,
    ): Record<string, UserSummary> {
        return [...members.values()].reduce(
            (map, m) => {
                const user = allUsers.get(m.userId);
                if (user !== undefined) {
                    map[user.userId] = {
                        ...user,
                        displayName: m.displayName ?? user.displayName,
                        username: user.username,
                    };
                }
                return map;
            },
            {} as Record<string, UserSummary>,
        );
    }

    function matchesSearch(searchTerm: string, userGroup: UserGroupDetails): boolean {
        if (searchTerm === "") return true;
        return userGroup.name.toLowerCase().includes(searchTerm);
    }

    function createUserGroup() {
        selectedGroup = {
            kind: "user_group",
            id: -1,
            name: "",
            members: new SvelteSet<string>(),
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
                    toastStore.showFailureToast(
                        i18nKey("communities.errors.deleteUserGroupFailed"),
                    );
                }
            })
            .finally(() => (groupToDelete = undefined));
    }

    function editUserGroup(e: Event, userGroup: UserGroupDetails) {
        e.stopPropagation();
        selectedGroup = userGroup;
    }

    function confirmDeleteUserGroup(e: Event, userGroup: UserGroupDetails) {
        e.stopPropagation();
        groupToDelete = userGroup;
        confirmingDelete = true;
    }

    export function reset() {
        selectedGroup = undefined;
        openedGroupId = undefined;
    }
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let userGroups = $derived([...app.selectedCommunity.userGroups.values()]);
    let canManageUserGroups = $derived(client.canManageUserGroups(community.id));
    let matchingGroups = $derived(userGroups.filter((ug) => matchesSearch(searchTermLower, ug)));
</script>

{#if confirmingDelete}
    <AreYouSure message={i18nKey("communities.confirmDeleteUserGroup")} action={deleteUserGroup} />
{/if}

{#if selectedGroup !== undefined}
    <UserGroup
        {canManageUserGroups}
        {community}
        {communityUsers}
        {communityUsersList}
        onCancel={reset}
        original={selectedGroup} />
{:else}
    <div class="user-groups">
        <div class="search-row">
            <div class="search">
                <Search
                    fill
                    searching={false}
                    bind:searchTerm
                    placeholder={i18nKey("communities.searchUserGroups")} />
            </div>
            {#if canManageUserGroups}
                <div class="add">
                    <HoverIcon onclick={createUserGroup}>
                        <Plus size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
            {/if}
        </div>
        <div class="groups">
            {#if matchingGroups.length === 0}
                <div class="no-groups">
                    <Translatable resourceKey={i18nKey("communities.noUserGroups")} />
                </div>
            {:else}
                {#each matchingGroups as userGroup}
                    <div class="user-group-card">
                        <CollapsibleCard
                            open={userGroup.id === openedGroupId}
                            headerText={i18nKey(userGroup.name)}>
                            {#snippet titleSlot()}
                                <h4 class="name">
                                    {#if canManageUserGroups}
                                        <div
                                            role="button"
                                            tabindex="0"
                                            onclick={(e) => editUserGroup(e, userGroup)}
                                            class="edit">
                                            <PencilOutline
                                                viewBox={"0 -3 24 24"}
                                                size={"1.2em"}
                                                color={"var(--icon-txt)"} />
                                        </div>
                                        <div
                                            role="button"
                                            tabindex="0"
                                            onclick={(e) => confirmDeleteUserGroup(e, userGroup)}
                                            class="delete">
                                            <DeleteOutline
                                                viewBox={"0 -3 24 24"}
                                                size={"1.2em"}
                                                color={"var(--icon-txt)"} />
                                        </div>
                                    {/if}
                                    <span class="name-text">{userGroup.name}</span>
                                    <span class="members">
                                        <span class="num"
                                            >{userGroup.members.size.toLocaleString()}</span>
                                        <Translatable resourceKey={i18nKey("members")} />
                                    </span>
                                </h4>
                            {/snippet}

                            {#each userGroup.members as member}
                                {#if communityUsers[member] !== undefined}
                                    <div class="user">
                                        <User user={communityUsers[member]} me={false} />
                                    </div>
                                {/if}
                            {/each}
                        </CollapsibleCard>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    :global(.user-group-card .body) {
        padding: 0;
    }

    :global(.user-group-card .header) {
        padding: $sp4 !important;
        @include mobile() {
            padding: $sp3 !important;
        }
    }

    .search-row {
        display: flex;
        align-items: center;
        gap: $sp3;
        padding: 0 $sp4;

        @include mobile() {
            padding: 0 $sp3;
        }

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

            .name {
                flex: auto;
                display: flex;
                gap: $sp2;
                align-items: center;
                @include font(medium, normal, fs-100);
                @include ellipsis();

                .name-text {
                    display: inline-block;
                    padding: toRem(6);
                    background-color: rgba(0, 0, 0, 0.05);
                    border-radius: $sp3;
                }

                .members {
                    @include font(light, normal, fs-70);
                    margin-left: $sp2;
                    color: var(--txt-light);
                    .num {
                        color: var(--txt);
                        font-weight: 700;
                    }
                }
            }

            .user-group {
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: toRem(12) $sp4;
                transition:
                    background-color ease-in-out 100ms,
                    border-color ease-in-out 100ms;
                gap: 12px;

                @media (hover: hover) {
                    &:not(.me):hover {
                        background-color: var(--members-hv);
                    }
                }

                @include mobile() {
                    padding: $sp3 toRem(10);
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
