<script lang="ts">
    import { AvatarSize } from "../../domain/user/user";
    import type { UserSummary } from "../../domain/user/user";
    import { avatarUrl, userStatus } from "../../domain/user/user.utils";
    import Avatar from "../Avatar.svelte";
    import { _ } from "svelte-i18n";

    export let user: UserSummary;
</script>

<div class="user" on:click>
    <span class="avatar">
        <Avatar url={avatarUrl(user)} status={userStatus(user)} size={AvatarSize.Small} />
    </span>
    <h4 class="details">
        {user.username}
    </h4>
</div>

<style type="text/scss">
    .user {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: $sp3;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;

        &:hover {
            background-color: var(--chatSummary-hv);
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
    }
</style>
