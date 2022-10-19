<script lang="ts">
    import Avatar from "./Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { AvatarSize, UserStatus } from "openchat-client";
    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let mode: "add" | "edit";
    export let user: UserSummary;

    function deleteUser() {
        dispatch("deleteUser", user);
    }
</script>

<div class="pill" class:add={mode === "add"} class:edit={mode === "edit"}>
    <div class="avatar">
        <Avatar url={client.userAvatarUrl(user)} status={UserStatus.None} size={AvatarSize.Small} />
    </div>
    <div class="username">{user.username}</div>
    <div on:click={deleteUser} class="delete">
        <Close size={"1em"} color={"#fff"} />
    </div>
</div>

<style type="text/scss">
    .pill {
        position: relative;
        margin-bottom: $sp4;
        margin-right: $sp3;
        display: inline-block;
        width: 60px;

        &.edit {
            color: var(--findUser-edit-pill-txt);
        }

        &.add {
            color: var(--findUser-add-pill-txt);
        }

        .username {
            @include ellipsis();
            text-align: center;
        }

        .delete {
            position: absolute;
            top: 0;
            right: 10px;
            cursor: pointer;
            width: 20px;
            height: 20px;
            color: #fff;
            background-color: var(--accent);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
    }
</style>
