<script lang="ts">
    import Avatar from "./Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let userOrGroup: UserOrUserGroup;

    $: name =
        userOrGroup.kind === "user_group" ? userOrGroup.name : client.getDisplayName(userOrGroup);
    $: avatarUrl =
        userOrGroup.kind === "user_group" ? undefined : client.userAvatarUrl(userOrGroup);
    $: userId = userOrGroup.kind === "user_group" ? undefined : userOrGroup.userId;

    function deleteUser() {
        dispatch("deleteUser", userOrGroup);
    }
</script>

<div class="user-pill" title={name}>
    <div class="avatar">
        <Avatar url={avatarUrl} {userId} size={AvatarSize.Small} />
    </div>
    <span class="username">{`${name}`}</span>
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
        border-radius: $sp2;
        gap: $sp2;
        @include box-shadow(1);

        .username {
            flex: auto;
            padding: $sp3;
        }

        .close {
            cursor: pointer;
            width: 20px;
            display: flex;
        }
    }
</style>
