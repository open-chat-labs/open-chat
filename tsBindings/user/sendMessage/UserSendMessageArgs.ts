// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { MessageContentInitial } from "../../shared/MessageContentInitial";
import type { MessageId } from "../../shared/MessageId";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { PinNumberWrapper } from "../../shared/PinNumberWrapper";
import type { ReplyContext } from "../../shared/ReplyContext";
import type { UserId } from "../../shared/UserId";

export type UserSendMessageArgs = { recipient: UserId, thread_root_message_index?: MessageIndex | undefined, message_id: MessageId, content: MessageContentInitial, replies_to?: ReplyContext | undefined, forwarding: boolean, block_level_markdown: boolean, message_filter_failed?: bigint | undefined, pin?: PinNumberWrapper | undefined, correlation_id: bigint, };
