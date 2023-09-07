<script lang="ts">
    import Input from "../../../Input.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Button from "../../../Button.svelte";
    import { _ } from "svelte-i18n";
    import type {
        Member,
        OpenChat,
        UserGroupDetails,
        UserLookup,
        UserSummary,
    } from "openchat-client";
    import Search from "../../../Search.svelte";
    import { getContext } from "svelte";
    import User from "../../groupdetails/User.svelte";

    const client = getContext<OpenChat>("client");

    export let original: UserGroupDetails;

    let userGroup = { ...original };

    $: communityMembers = client.currentCommunityMembers;
    $: allUsers = client.userStore;

    $: communityUsers = createLookup($communityMembers, $allUsers);
    $: groupUsers = [...userGroup.members].map((m) => communityUsers[m]);
    $: matchedUsers = Object.values(communityUsers).filter((u) => matchesSearch(searchTerm, u));
    $: nameDirty = original.name !== userGroup.name;

    let searchTerm = "";

    const MIN_LENGTH = 3; // TODO - check what this actually *is*
    const MAX_LENGTH = 25; // TODO - check what this actually *is*

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        // TODO - exclude anyone who is already in the group
        if (searchTerm === "") return false;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function addUserToGroup(user: UserSummary) {
        searchTerm = "";
        userGroup.members.add(user.userId);
        userGroup = userGroup; //:puke: trigger a reaction
    }

    function createLookup(users: Member[], allUsers: UserLookup): Record<string, UserSummary> {
        return users.reduce((map, u) => {
            const user = allUsers[u.userId];
            if (user !== undefined) {
                map[user.userId] = user;
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
            countdown
            invalid={(nameDirty && userGroup.name.length < MIN_LENGTH) ||
                userGroup.name.length > MAX_LENGTH}
            placeholder={$_("communities.enterUserGroupName")} />
    </div>

    <div class="search">
        <Search fill searching={false} bind:searchTerm placeholder={"searchUsersPlaceholder"} />
    </div>

    <div class="searched-users">
        {#each matchedUsers as user}
            <User on:open={() => addUserToGroup(user)} {user} me={false} {searchTerm} />
        {/each}
    </div>

    <div class="users">
        <div class="legend">
            {$_("communities.userGroupMembers")}
        </div>
        {#each groupUsers as user}
            <User {user} me={false} {searchTerm} />
        {/each}
    </div>

    <ButtonGroup align="fill">
        <Button secondary>Cancel</Button>
        <Button>Save</Button>
    </ButtonGroup>
</div>

<style lang="scss">
    :global(.user-group .header .input-wrapper) {
        margin-bottom: 0;
    }

    .user-group {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        height: 100%;
        justify-content: space-between;

        .users {
            flex: auto;
            border: 1px solid var(--bd);
            border-radius: $sp2;

            .legend {
                @include font(book, normal, fs-80);
                padding: $sp3;
            }
        }
    }
</style>
