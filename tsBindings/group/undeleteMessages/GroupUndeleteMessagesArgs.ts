// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { MessageId } from "../../shared/MessageId";
import type { MessageIndex } from "../../shared/MessageIndex";

export type GroupUndeleteMessagesArgs = { thread_root_message_index?: MessageIndex | undefined, 
/**
 * @default []
 */
message_ids: Array<MessageId>, correlation_id: bigint, };
