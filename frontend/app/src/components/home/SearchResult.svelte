<script lang="ts">
    import { AvatarSize, UserStatus } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import { _ } from "svelte-i18n";

    export let showSpinner: boolean | undefined = false;
    export let avatarUrl: string;
    export let index: number;
</script>

<div class="search-result" class:first={index === 0} on:click>
    <span class="avatar">
        <Avatar url={avatarUrl} size={AvatarSize.Default} />
    </span>
    <div class="details">
        <slot />
    </div>

    {#if showSpinner}
        <div class="spinner" />
    {/if}
</div>

<style type="text/scss">
    .search-result {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        padding: $sp4 $sp4;
        margin-bottom: 0;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        border-bottom: var(--chatSummary-bd);

        &.first {
            border-top: var(--chatSummary-bd);
        }

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        @include mobile() {
            padding: $sp3;
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
        overflow: hidden;
    }
    .spinner {
        @include loading-spinner(1em, 0.5em, var(--spinner));
        padding: 0 $sp4;
    }
</style>
