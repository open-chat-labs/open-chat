<svelte:options immutable={true} />

<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import type { GroupChatSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    export let group: GroupChatSummary;
</script>

<div class="container">
    <h4 class="welcome">{$_("group.welcome", { values: { groupName: group.name } })}</h4>
    {#if group.description.length > 0}
        <div>
            <Markdown text={group.description} />
        </div>
    {/if}
    <div class="pop">
        <Avatar url={client.groupAvatarUrl(group)} size={AvatarSize.Large} />
    </div>
    <div>
        {$_(group.public ? "thisIsPublicGroupWithN" : "thisIsPrivateGroupWithN", {
            values: { number: group.memberCount },
        })}
    </div>
    <!-- {#if !group.historyVisibleToNewJoiners}
        <div>{$_("group.historyPrivateMessage")}</div>
    {/if} -->
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

    .welcome {
        @include font(bold, normal, fs-120);
        color: var(--txt);
    }

    .pop {
        @include pop(400ms);
    }
</style>
