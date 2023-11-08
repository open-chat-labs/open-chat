<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { OPENCHAT_BOT_USER_ID, type DeletedContent, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    export let content: DeletedContent;
    export let undeleting: boolean;

    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`;
    $: communityMembers = client.currentCommunityMembers;
    $: username = client.getDisplayNameById(content.deletedBy, $communityMembers);
</script>

<div class="deleted">
    {#if undeleting}
        {$_("undeletingMessage", {
            values: { username, timestamp: timestampStr },
        })}
    {:else if content.deletedBy === OPENCHAT_BOT_USER_ID}
        <Markdown
            text={$_("messageDeletedByOpenChatBot", {
                values: {
                    username,
                    timestamp: timestampStr,
                    rules: "/guidelines?section=3",
                    modclub: "https://modclub.ai/",
                },
            })} />
    {:else}
        {$_("messageDeleted", {
            values: { username, timestamp: timestampStr },
        })}
    {/if}
</div>

<style lang="scss">
    .deleted {
        @include font(light, italic, fs-80);
    }
</style>
