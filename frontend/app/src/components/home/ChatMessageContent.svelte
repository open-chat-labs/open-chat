<svelte:options immutable={true} />

<script lang="ts">
    import VideoContent from "./VideoContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import GiphyContent from "./GiphyContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import PollContent from "./PollContent.svelte";
    import FileContent from "./FileContent.svelte";
    import TextContent from "./TextContent.svelte";
    import PrizeContent from "./PrizeContent.svelte";
    import PrizeWinnerContent from "./PrizeWinnerContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import MessageReminderContent from "./MessageReminderContent.svelte";
    import MessageReminderCreatedContent from "./MessageReminderCreatedContent.svelte";
    import ProposalContent from "./proposals/ProposalContent.svelte";
    import IntersectionObserver from "./IntersectionObserver.svelte";
    import type { MessageContent } from "openchat-client";
    import { _ } from "svelte-i18n";

    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;
    export let first: boolean;
    export let reply: boolean = false;
    export let pinned: boolean = false;
    export let height: number | undefined = undefined;
    export let readonly: boolean;
    export let groupChat: boolean;
    export let senderId: string;
    export let myUserId: string | undefined;
    export let messageId: bigint;
    export let edited: boolean;
    export let chatId: string;
    export let messageIndex: number;
    export let collapsed = false;
    export let undeleting: boolean = false;
</script>

{#if content.kind === "text_content"}
    <TextContent {fill} {truncate} {pinned} {messageId} {content} {edited} {height} />
{:else if content.kind === "image_content"}
    <IntersectionObserver let:intersecting>
        <ImageContent {edited} {intersecting} {fill} {content} {reply} {pinned} {height} />
    </IntersectionObserver>
{:else if content.kind === "video_content"}
    <VideoContent {edited} {fill} {content} {reply} {height} />
{:else if content.kind === "audio_content"}
    <AudioContent {edited} {content} />
{:else if content.kind === "file_content"}
    <FileContent {edited} {me} {content} {reply} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} {undeleting} />
{:else if content.kind === "crypto_content"}
    <CryptoContent {senderId} {content} {me} {first} {groupChat} />
{:else if content.kind === "placeholder_content"}
    <PlaceholderContent />
{:else if content.kind === "prize_content"}
    <PrizeContent on:upgrade {chatId} {messageId} {content} />
{:else if content.kind === "prize_winner_content"}
    <PrizeWinnerContent on:goToMessageIndex {content} />
{:else if content.kind === "poll_content"}
    <PollContent {readonly} {me} {content} {myUserId} {senderId} on:registerVote />
{:else if content.kind === "giphy_content"}
    <IntersectionObserver let:intersecting>
        <GiphyContent {edited} {intersecting} {fill} {content} {reply} {height} />
    </IntersectionObserver>
{:else if content.kind === "proposal_content"}
    <ProposalContent
        {content}
        {chatId}
        {messageIndex}
        {messageId}
        {collapsed}
        {readonly}
        {reply}
        on:expandMessage />
{:else if content.kind === "message_reminder_created_content" && !content.hidden}
    <MessageReminderCreatedContent {content} />
{:else if content.kind === "message_reminder_content"}
    <MessageReminderContent {content} />
{/if}
