<svelte:options immutable={true} />

<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    import FilteredUsername from "../../FilteredUsername.svelte";
    import type { PartialUserSummary } from "openchat-shared";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;
    export let me: boolean = false;
    export let searchTerm: string = "";
    export let role: string | undefined = undefined;

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    let hovering = false;

    function onClick() {
        dispatch("open", user.userId);
    }        
</script>

<div
    class="member"
    class:me
    on:click={onClick}
    role="button"
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}>
    <span class="avatar">
        <Avatar
            statusBorder={hovering && !me ? "var(--members-hv)" : "transparent"}
            userId={user.userId}
            url={client.userAvatarUrl(user)}
            size={AvatarSize.Default} />
    </span>
    <div class="details">
        <h4 class:diamond={user.diamond}>
            <FilteredUsername {searchTerm} username={user.username} {me} />
        </h4>
        {#if role !== undefined}
            <span class="role">
                ({$_(role)})
            </span>
        {/if}
    </div>
    <slot />
</div>

<style type="text/scss">
    .member {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        gap: 12px;

        &:not(.me) {
            cursor: pointer;
        }

        &:not(.me):hover {
            background-color: var(--members-hv);
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .details {
        flex: 1;
        display: flex;
        align-items: center;
        @include ellipsis();
        @include font(medium, normal, fs-100);
    }

    .diamond {
        @include diamond();
    }

    .role {
        margin: 0 $sp3;
        @include font(light, normal, fs-70);
    }
</style>
