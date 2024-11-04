<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import {
        OPENCHAT_BOT_USER_ID,
        type DeletedContent,
        type OpenChat,
        currentCommunityMembers as communityMembers,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Markdown from "./Markdown.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    export let content: DeletedContent;
    export let undeleting: boolean;

    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`;
    $: username = client.getDisplayNameById(content.deletedBy, $communityMembers);
</script>

<div class="deleted">
    {#if undeleting}
        <Translatable
            resourceKey={i18nKey("undeletingMessage", {
                username,
                timestamp: timestampStr,
            })} />
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
        <Translatable
            resourceKey={i18nKey("messageDeleted", {
                username,
                timestamp: timestampStr,
            })} />
    {/if}
</div>

<style lang="scss">
    .deleted {
        @include font(light, italic, fs-80);
    }
</style>
