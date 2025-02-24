<svelte:options immutable />

<script lang="ts">
    import ReportedMessageContent from "./ReportedMessageContent.svelte";
    import VideoContent from "./VideoContent.svelte";
    import VideoCallContent from "./VideoCallContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import GiphyContent from "./GiphyContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import PollContent from "./PollContent.svelte";
    import FileContent from "./FileContent.svelte";
    import TextContent from "./TextContent.svelte";
    import PrizeContent from "./PrizeContent.svelte";
    import UserReferralCardContent from "./UserReferralCardContent.svelte";
    import PrizeWinnerContent from "./PrizeWinnerContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import BlockedContent from "./BlockedContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import MessageReminderContent from "./MessageReminderContent.svelte";
    import MessageReminderCreatedContent from "./MessageReminderCreatedContent.svelte";
    import ProposalContent from "./proposals/ProposalContent.svelte";
    import type { MessageContent, MessageContext } from "openchat-client";
    import { _ } from "svelte-i18n";
    import MessageContentInitial from "./MessageContentInitial.svelte";
    import P2PSwapContent from "./P2PSwapContent.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import BotPlaceholderContent from "./BotPlaceholderContent.svelte";
    import BotRenderedContent from "./BotRenderedContent.svelte";

    export let content: MessageContent;
    export let me: boolean = false;
    export let truncate: boolean = false;
    export let fill: boolean;
    export let reply: boolean = false;
    export let pinned: boolean = false;
    export let height: number | undefined = undefined;
    export let readonly: boolean;
    export let senderId: string;
    export let myUserId: string | undefined;
    export let messageId: bigint;
    export let edited: boolean;
    export let messageContext: MessageContext;
    export let messageIndex: number;
    export let collapsed = false;
    export let undeleting: boolean = false;
    export let intersecting: boolean;
    export let failed: boolean;
    export let timestamp: bigint | undefined = undefined;
    export let blockLevelMarkdown: boolean;
</script>

{#if content.kind === "text_content"}
    <TextContent
        {me}
        {fill}
        {truncate}
        {pinned}
        {content}
        {edited}
        {blockLevelMarkdown}
        on:removePreview />
{:else if content.kind === "image_content"}
    <ImageContent
        {edited}
        {intersecting}
        {fill}
        {content}
        {reply}
        {pinned}
        {height}
        {blockLevelMarkdown} />
{:else if content.kind === "video_content"}
    <VideoContent {edited} {fill} {content} {reply} {height} {blockLevelMarkdown} />
{:else if content.kind === "bot_rendered_content"}
    <BotRenderedContent {content} />
{:else if content.kind === "video_call_content"}
    <VideoCallContent on:startVideoCall {senderId} {messageIndex} {content} {timestamp} />
{:else if content.kind === "audio_content"}
    <AudioContent {me} {edited} {content} {blockLevelMarkdown} />
{:else if content.kind === "file_content"}
    <FileContent {edited} {me} {content} {blockLevelMarkdown} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} {undeleting} />
{:else if content.kind === "blocked_content"}
    <BlockedContent />
{:else if content.kind === "crypto_content"}
    <CryptoContent {senderId} {content} {me} />
{:else if content.kind === "placeholder_content"}
    <PlaceholderContent />
{:else if content.kind === "bot_placeholder_content"}
    <BotPlaceholderContent />
{:else if content.kind === "prize_content_initial"}
    <MessageContentInitial text={i18nKey("prizes.creatingYourPrizeMessage")} {failed} />
{:else if content.kind === "p2p_swap_content_initial"}
    <MessageContentInitial
        text={i18nKey(failed ? "p2pSwap.failedToCreateMessage" : "p2pSwap.creatingYourMessage")}
        {failed} />
{:else if content.kind === "prize_content"}
    <PrizeContent
        on:upgrade
        on:verifyHumanity
        on:claimDailyChit
        chatId={messageContext.chatId}
        {messageId}
        {content}
        {me} />
{:else if content.kind === "p2p_swap_content"}
    <P2PSwapContent
        on:upgrade
        {senderId}
        {messageContext}
        {messageId}
        {content}
        {me}
        {reply}
        {pinned} />
{:else if content.kind === "prize_winner_content"}
    <PrizeWinnerContent {content} />
{:else if content.kind === "poll_content"}
    <PollContent {readonly} {me} {content} {myUserId} {senderId} on:registerVote />
{:else if content.kind === "giphy_content"}
    <GiphyContent {edited} {intersecting} {fill} {content} {reply} {height} {blockLevelMarkdown} />
{:else if content.kind === "proposal_content"}
    <ProposalContent
        {content}
        chatId={messageContext.chatId}
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
{:else if content.kind === "reported_message_content"}
    <ReportedMessageContent {content} />
{:else if content.kind === "meme_fighter_content"}
    <ImageContent {edited} {intersecting} {fill} {content} {reply} {pinned} {height} />
{:else if content.kind === "user_referral_card"}
    <UserReferralCardContent />
{/if}
