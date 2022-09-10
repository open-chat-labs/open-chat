<svelte:options immutable={true} />

<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import { groupAvatarUrl } from "../../domain/user/user.utils";
    import { _ } from "svelte-i18n";

    export let group: GroupChatSummary;
    export let noVisibleEvents: boolean;
</script>

<div class="container">
    <div>{$_("group.welcome")}<span class="name">{group.name}</span></div>
    {#if group.description.length > 0}
        <div>
            {group.description}
        </div>
    {/if}
    <div>
        <Avatar url={groupAvatarUrl(group)} status={UserStatus.None} size={AvatarSize.ExtraLarge} />
    </div>
    <div>
        {$_(group.public ? "thisIsPublicGroupWithN" : "thisIsPrivateGroupWithN", {
            values: { number: group.memberCount },
        })}
    </div>
    {#if noVisibleEvents}
        <div>{$_("group.historyPrivateMessage")}</div>
    {/if}
</div>

<style type="text/scss">
    .container {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        margin: $sp4 auto;
        text-align: center;
        background-color: var(--timeline-bg);
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);
        max-width: 480px;
    }

    .name {
        font-weight: bold;
    }
</style>
