<script lang="ts">
    import Avatar from "./Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { AvatarSize, currentCommunityMembers as communityMembers } from "openchat-client";
    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let userOrGroup: UserOrUserGroup;

    $: avatarUrl =
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.userAvatarUrl(userOrGroup);
    $: userId = client.userOrUserGroupId(userOrGroup);

    $: name = client.userOrUserGroupName(userOrGroup);
    $: displayName =
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.getDisplayName(userOrGroup, $communityMembers);

    function deleteUser() {
        dispatch("deleteUser", userOrGroup);
    }
</script>

<div class="user-pill" title={name}>
    <div class="avatar">
        <Avatar url={avatarUrl} {userId} size={AvatarSize.Small} />
    </div>
    <div class="name">
        {#if displayName !== undefined}
            <span>{displayName}</span>
        {/if}
        <span class="username">@{name}</span>
    </div>
    <span class="close" on:click={deleteUser}>
        <Close size={"1.2em"} color={"var(--button-txt)"} />
    </span>
</div>

<style lang="scss">
    .user-pill {
        background: var(--button-bg);
        color: var(--button-txt);
        display: inline-flex;
        padding: $sp2 $sp3;
        align-items: center;
        border-radius: var(--rd);
        gap: $sp2;
        @include box-shadow(1);

        .name {
            flex: auto;
            padding: $sp3;
        }

        .username {
            color: var(--button-disabled-txt);
        }

        .close {
            cursor: pointer;
            width: 20px;
            display: flex;
        }
    }
</style>
