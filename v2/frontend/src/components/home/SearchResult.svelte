<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import Avatar from "../Avatar.svelte";
    import { _ } from "svelte-i18n";

    export let showSpinner: boolean | undefined = false;
    export let avatarUrl: string;
</script>

<div class="group" on:click>
    <span class="avatar">
        <Avatar url={avatarUrl} status={UserStatus.None} size={AvatarSize.Small} />
    </span>
    <div class="details">
        <slot />
    </div>

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
    .name {
        margin-bottom: $sp3;
    }
    .desc {
        color: var(--chatSummary-txt2);
        @include font(light, normal, fs-80);
        @include ellipsis();
    }
    .details {
        flex: 1;
        padding: 0 5px;
        overflow: hidden;
    }
    .spinner {
        @include loading-spinner(1em, 0.5em, false, var(--spinner));
        padding: 0 $sp4;
    }
</style>
