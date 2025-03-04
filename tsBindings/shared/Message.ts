// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { BotMessageContext } from "./BotMessageContext";
import type { MessageContent } from "./MessageContent";
import type { MessageId } from "./MessageId";
import type { MessageIndex } from "./MessageIndex";
import type { Reaction } from "./Reaction";
import type { ReplyContext } from "./ReplyContext";
import type { ThreadSummary } from "./ThreadSummary";
import type { Tips } from "./Tips";
import type { UserId } from "./UserId";

export type Message = { message_index: MessageIndex, message_id: MessageId, sender: UserId, content: MessageContent, bot_context?: BotMessageContext, replies_to?: ReplyContext, reactions: Array<[Reaction, Array<UserId>]>, tips: Tips, thread_summary?: ThreadSummary, edited: boolean, forwarded: boolean, block_level_markdown: boolean, };
