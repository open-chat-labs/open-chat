<script lang="ts">
    import { app, OPENCHAT_BOT_USER_ID, type DeletedContent, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: DeletedContent;
        undeleting: boolean;
    }

    let { content, undeleting }: Props = $props();

    let date = $derived(new Date(Number(content.timestamp)));
    let timestampStr = $derived(
        `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`,
    );
    let username = $derived(
        client.getDisplayNameById(content.deletedBy, app.selectedCommunityDetails.members),
    );
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
