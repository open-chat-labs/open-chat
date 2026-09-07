<script lang="ts">
    import {
        currentUserIdStore,
        type MessageContent,
        type MessageContext,
        type OgPreview,
        type RehydratedMessagePreview,
    } from "@client";
    import { i18nKey } from "../../i18n/i18n";
    import ActionCardContent from "./ActionCardContent.svelte";
    import AudioContent from "./AudioContent.svelte";
    import BlockedContent from "./BlockedContent.svelte";
    import BotPlaceholderContent from "./BotPlaceholderContent.svelte";
    import CryptoContent from "./CryptoContent.svelte";
    import DeletedContent from "./DeletedContent.svelte";
    import ModerationReportContent from "./ModerationReportContent.svelte";
    import RestrictedMessageContent from "./RestrictedMessageContent.svelte";
    import FileContent from "./FileContent.svelte";
    import GiphyContent from "./GiphyContent.svelte";
    import ImageContent from "./ImageContent.svelte";
    import MessageContentInitial from "./MessageContentInitial.svelte";
    import MessageReminderContent from "./MessageReminderContent.svelte";
    import MessageReminderCreatedContent from "./MessageReminderCreatedContent.svelte";
    import P2PSwapContent from "./P2PSwapContent.svelte";
    import PlaceholderContent from "./PlaceholderContent.svelte";
    import PollContent from "./PollContent.svelte";
    import PrizeContent from "./PrizeContent.svelte";
    import PrizeWinnerContent from "./PrizeWinnerContent.svelte";
    import ProposalContent from "./proposals/ProposalContent.svelte";
    import ReportedMessageContent from "./ReportedMessageContent.svelte";
    import TextContent from "./TextContent.svelte";
    import UserReferralCardContent from "./UserReferralCardContent.svelte";
    import VideoCallContent from "./VideoCallContent.svelte";
    import VideoContent from "./VideoContent.svelte";

    interface Props {
        content: MessageContent;
        me?: boolean;
        truncate?: boolean;
        fill: boolean;
        reply?: boolean;
        pinned?: boolean;
        height?: number | undefined;
        readonly: boolean;
        senderId: string;
        messageId: bigint;
        edited: boolean;
        messageContext: MessageContext;
        messageIndex: number;
        collapsed?: boolean;
        undeleting?: boolean;
        intersecting: boolean;
        failed: boolean;
        reconciliationTrigger?: boolean;
        timestamp?: bigint | undefined;
        blockLevelMarkdown: boolean;
        onExpandMessage?: (() => void) | undefined;
        onRemovePreview?: (url: string) => void;
        onRegisterVote?: (vote: { type: "delete" | "register"; answerIndex: number }) => void;
        onRespondToActionCard?: (
            response: "confirm" | "cancel",
            confirmPayloadOverride?: Uint8Array,
            confirmationGrant?: Uint8Array,
        ) => boolean | Promise<boolean>;
        ogPreviews?: OgPreview[];
        messagePreviews?: RehydratedMessagePreview[];
    }

    let {
        content,
        me = false,
        truncate = false,
        fill,
        reply = false,
        pinned = false,
        height = undefined,
        readonly,
        senderId,
        messageId,
        edited,
        messageContext,
        messageIndex,
        collapsed = false,
        undeleting = false,
        intersecting,
        failed,
        reconciliationTrigger = false,
        timestamp = undefined,
        blockLevelMarkdown,
        onExpandMessage = undefined,
        onRemovePreview,
        onRegisterVote,
        onRespondToActionCard,
        ogPreviews = [],
        messagePreviews = [],
    }: Props = $props();
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
        {onRemovePreview}
        {ogPreviews}
        {messagePreviews}
    />
{:else if content.kind === "image_content"}
    <ImageContent
        {edited}
        {intersecting}
        {fill}
        {content}
        {reply}
        {pinned}
        {height}
        {blockLevelMarkdown}
    />
{:else if content.kind === "video_content"}
    <VideoContent {edited} {fill} {content} {reply} {height} {blockLevelMarkdown} />
{:else if content.kind === "video_call_content"}
    <VideoCallContent {senderId} {messageIndex} {content} {timestamp} />
{:else if content.kind === "audio_content"}
    <AudioContent {me} {edited} {content} {blockLevelMarkdown} />
{:else if content.kind === "file_content"}
    <FileContent {edited} {me} {content} {blockLevelMarkdown} />
{:else if content.kind === "deleted_content"}
    <DeletedContent {content} {undeleting} />
{:else if content.kind === "restricted_content"}
    <RestrictedMessageContent />
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
        {failed}
    />
{:else if content.kind === "prize_content"}
    <PrizeContent chatId={messageContext.chatId} {messageId} {content} {me} {intersecting} />
{:else if content.kind === "p2p_swap_content"}
    <P2PSwapContent {senderId} {messageContext} {messageId} {content} {me} {reply} {pinned} />
{:else if content.kind === "prize_winner_content"}
    <PrizeWinnerContent {content} {intersecting} />
{:else if content.kind === "poll_content"}
    <PollContent {readonly} {me} {content} {senderId} {onRegisterVote} />
{:else if content.kind === "action_card_content"}
    <ActionCardContent
        {content}
        {readonly}
        chatId={messageContext.chatId}
        {messageId}
        threadRootMessageIndex={messageContext.threadRootMessageIndex}
        viewerId={$currentUserIdStore}
        {reconciliationTrigger}
        onRespond={onRespondToActionCard}
    />
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
        {onExpandMessage}
    />
{:else if content.kind === "message_reminder_created_content" && !content.hidden}
    <MessageReminderCreatedContent {content} />
{:else if content.kind === "message_reminder_content"}
    <MessageReminderContent {content} />
{:else if content.kind === "moderation_report_content"}
    <ModerationReportContent {content} />
{:else if content.kind === "reported_message_content"}
    <ReportedMessageContent {content} />
{:else if content.kind === "meme_fighter_content"}
    <ImageContent {edited} {intersecting} {fill} {content} {reply} {pinned} {height} />
{:else if content.kind === "user_referral_card"}
    <UserReferralCardContent />
{/if}
