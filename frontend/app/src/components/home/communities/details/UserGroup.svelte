<script lang="ts">
    import Input from "../../../Input.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Button from "../../../Button.svelte";
    import { _ } from "svelte-i18n";
    import type {
        Member,
        OpenChat,
        UserGroupDetails,
        UserLookup,
        UserSummary,
        CommunitySummary,
    } from "openchat-client";
    import Search from "../../../Search.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import User from "../../groupdetails/User.svelte";
    import { iconSize } from "../../../../stores/iconSize";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;
    export let original: UserGroupDetails;
    export let canManageUserGroups: boolean;

    let userGroup = { ...original };
    let added: Set<string> = new Set();
    let removed: Set<string> = new Set();

    $: communityMembers = client.currentCommunityMembers;
    $: allUsers = client.userStore;

    $: communityUsers = createLookup($communityMembers, $allUsers);
    $: groupUsers = [...userGroup.members].map((m) => communityUsers[m]);
    $: matchedUsers = Object.values(communityUsers).filter((u) => matchesSearch(searchTerm, u));
    $: nameDirty = original.name !== userGroup.name;
    $: dirty = nameDirty || usersDirty;
    $: nameValid = userGroup.name.length >= MIN_LENGTH && userGroup.name.length <= MAX_LENGTH;
    $: valid = nameValid && userGroup.members.size > 0;

    let searchTerm = "";
    let usersDirty = false;
    let saving = false;

    const MIN_LENGTH = 3; // TODO - check what this actually *is*
    const MAX_LENGTH = 25; // TODO - check what this actually *is*

    // we are going to just wait for the save to succeed here rather than mess about with
    // local updates since this is probably not a very common operation and it's much simpler this way
    function save() {
        saving = true;
        (userGroup.id === -1
            ? client.createUserGroup(community.id, userGroup)
            : client.updateUserGroup(community.id, userGroup, added, removed)
        )
            .then((resp) => {
                if (resp.kind === "success") {
                    cancel();
                } else {
                    console.log("TODO - deal with errors", resp);
                }
            })
            .finally(() => (saving = false));
    }

    function cancel() {
        reset();
        dispatch("cancel");
    }

    function reset() {
        userGroup = original;
        added = new Set();
        removed = new Set();
    }

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        // TODO - exclude anyone who is already in the group
        if (searchTerm === "") return false;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function addUserToGroup(user: UserSummary) {
        searchTerm = "";
        added.add(user.userId);
        removed.delete(user.userId);
        changeUsers(() => userGroup.members.add(user.userId));
    }

    function removeUserFromGroup(user: UserSummary) {
        removed.add(user.userId);
        added.delete(user.userId);
        changeUsers(() => userGroup.members.delete(user.userId));
    }

    function changeUsers(fn: () => void) {
        fn();
        usersDirty = true;
        userGroup = userGroup; //:puke: trigger a reaction
    }

    function createLookup(
        users: Map<string, Member>,
        allUsers: UserLookup
    ): Record<string, UserSummary> {
        return [...users.values()].reduce((map, m) => {
            const user = allUsers[m.userId];
            if (user !== undefined) {
                map[user.userId] = { ...user, displayName: m.displayName ?? user.displayName };
            }
            return map;
        }, {} as Record<string, UserSummary>);
    }
</script>

<div class="user-group">
    <div class="header">
        <Input
            bind:value={userGroup.name}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            disabled={!canManageUserGroups}
            countdown
            invalid={nameDirty && !nameValid}
            placeholder={$_("communities.enterUserGroupName")} />
    </div>

    {#if canManageUserGroups}
        <div class="search">
            <Search fill searching={false} bind:searchTerm placeholder={"searchUsersPlaceholder"} />
        </div>
    {/if}

    {#if matchedUsers.length > 0}
        <div class="searched-users">
            {#each matchedUsers as user}
                <User on:open={() => addUserToGroup(user)} {user} me={false} {searchTerm} />
            {/each}
        </div>
    {/if}

    <div class="users">
        <div class="legend">
            {$_("communities.userGroupMembers")}
        </div>
        {#each groupUsers as user}
            <div class="user">
                <User {user} me={false} {searchTerm}>
                    {#if canManageUserGroups}
                        <div on:click={() => removeUserFromGroup(user)} class="delete">
                            <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                    {/if}
                </User>
            </div>
        {/each}
    </div>

    <div class="buttons">
        <ButtonGroup align="fill">
            <Button on:click={cancel} secondary>{$_("cancel")}</Button>
            {#if canManageUserGroups}
                <Button on:click={save} disabled={!dirty || !valid || saving} loading={saving}
                    >{$_("save")}</Button>
            {/if}
        </ButtonGroup>
    </div>
</div>

<style lang="scss">
    :global(.user-group .header .input-wrapper) {
        margin-bottom: 0;
    }

    :global(.user-group .search .wrapper) {
        padding: 0 $sp3;
    }

    .header,
    .search,
    .buttons {
        padding: 0 $sp4;
    }

    .user-group {
        display: flex;
        flex-direction: column;
        gap: toRem(12);
        height: 100%;
        justify-content: space-between;

        .users {
            flex: auto;

            .legend {
                @include font(book, normal, fs-80);
                padding: $sp4;
                border-bottom: 1px solid var(--bd);
            }

            .user {
                .delete {
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
