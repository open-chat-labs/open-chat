<svelte:options immutable={true} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import AudioContent from "./AudioContent.svelte";

    import FileContent from "./FileContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import type { MessageContent } from "../../domain/chat/chat";
    import { userStore } from "stores/user";
    import { _ } from "svelte-i18n";

    const SIZE_LIMIT = 1000;
    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;

    const mentionRegex = /@UserId\((.+)\)/g;

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }

        return text;
    }

    function parseMentions(text: string): string {
        return text.replace(mentionRegex, (_match, p1) => {
            // just make these bold for now, would be better to make them clickable links
            const username = $userStore[p1].username ?? $_("unknown");
            // return `**[@${username}](./#/${p1} "${username}")**`;
            return `**@${username}**`;
        });
    }
</script>

{#if content.kind === "text_content"}
    <Markdown text={truncateText(parseMentions(content.text))} />
{:else if content.kind === "image_content"}
    <ImageContent {fill} {content} {reply} {height} />
{:else if content.kind === "video_content"}
    <VideoContent {fill} {content} {reply} {height} />
{:else if content.kind === "audio_content"}
    <AudioContent {content} />
{:else if content.kind === "file_content"}
    <FileContent {me} {content} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} />
{:else if content.kind === "crypto_content"}
    <div>Crypto content</div>
{:else if content.kind === "placeholder_content"}
    <PlaceholderContent />
{/if}
