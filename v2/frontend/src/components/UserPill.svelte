<script lang="ts">
    import type { UserSummary } from "../domain/user/user";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let user: UserSummary;

    function deleteUser() {
        dispatch("deleteUser", user);
    }
</script>

<div class="pill">
    <div class="avatar" />
    <div class="username">{user.username}</div>
    <div on:click={deleteUser} class="delete" />
</div>

<style type="text/scss">
    .pill {
        &.avatar {
        }
        &.username {
        }
        &.delete {
        }
    }
</style>
