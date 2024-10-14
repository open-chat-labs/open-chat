// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "../shared/ChatId";
import type { MessageIndex } from "../shared/MessageIndex";
import type { TSBoolWithDefault } from "../shared/TSBoolWithDefault";
import type { TSBytes } from "../shared/TSBytes";

export type UserGroupChatSummary = { chat_id: ChatId, local_user_index_canister_id: TSBytes, read_by_me_up_to?: MessageIndex | undefined, 
/**
 * @default {}
 */
threads_read: Record<MessageIndex, MessageIndex>, archived: TSBoolWithDefault, date_read_pinned?: bigint | undefined, };
