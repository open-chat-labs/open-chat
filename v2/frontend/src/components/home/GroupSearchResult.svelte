<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { avatarUrl } from "../../domain/user/user.utils";
    import Avatar from "../Avatar.svelte";
    import { _ } from "svelte-i18n";
    import type { GroupMatch } from "../../domain/search/search";
    import Loading from "../Loading.svelte";

    export let group: GroupMatch;
    export let showSpinner: boolean;
</script>

<div class="group" on:click>
    <span class="avatar">
        <Avatar
            url={avatarUrl({ blobUrl: undefined })}
            status={UserStatus.None}
            size={AvatarSize.Small} />
    </span>
    <h4 class="details">
        {group.name}
    </h4>
    {#if showSpinner}
        <div class="spinner" />
    {/if}
</div>

<style type="text/scss">
    .group {
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
    .spinner {
        @include loading-spinner(1em, 0.5em, false, var(--spinner));
        padding: 0 $sp4;
    }
</style>
