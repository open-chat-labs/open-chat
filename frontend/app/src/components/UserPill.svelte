<script lang="ts">
    import Avatar from "./Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, PartialUserSummary } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let user: PartialUserSummary;

    function deleteUser() {
        dispatch("deleteUser", user);
    }
</script>

<div class="user-pill" title={user.username}>
    <div class="avatar">
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Default} />
    </div>
    <span class="username">{`@${user.username}`}</span>
    <span class="close" on:click={deleteUser}>
        <Close size={"1.2em"} color={"var(--button-txt)"} />
    </span>
</div>

<style type="text/scss">
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
