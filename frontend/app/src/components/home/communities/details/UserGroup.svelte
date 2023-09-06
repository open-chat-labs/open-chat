<script lang="ts">
    import Input from "../../../Input.svelte";
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

    const client = getContext<OpenChat>("client");

    export let userGroup: UserGroupDetails;

    $: communityMembers = client.currentCommunityMembers;
    $: allUsers = client.userStore;

    $: communityUsers = createLookup($communityMembers, $allUsers);
    $: groupUsers = [...userGroup.members].map((m) => communityUsers[m]);
    $: matchedUsers = Object.values(communityUsers).filter((u) => matchesSearch(searchTerm, u));

    let searchTerm = "";

    const MIN_LENGTH = 3; // TODO - check what this actually *is*
    const MAX_LENGTH = 25; // TODO - check what this actually *is*

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        if (searchTerm === "") return true;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
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
            invalid={userGroup.name.length < MIN_LENGTH || userGroup.name.length > MAX_LENGTH}
            placeholder={$_("communities.enterUserGroupName")} />
    </div>

    <Search fill searching={false} bind:searchTerm placeholder={"searchUsersPlaceholder"} />

    <div class="searched-users">
        <h1>Matched users</h1>
        {#each matchedUsers as user}
            <div class="user">
                {user.username}
            </div>
        {/each}
    </div>

    <div class="users">
        <h1>Group users</h1>
        {#each groupUsers as user}
            <div class="user">
                {user.username}
            </div>
        {/each}
    </div>
</div>

<style lang="scss">
</style>
