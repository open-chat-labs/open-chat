// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Chat } from "../shared/Chat";
import type { EventIndex } from "../shared/EventIndex";
import type { MessageId } from "../shared/MessageId";
import type { MessageIndex } from "../shared/MessageIndex";
import type { UserId } from "../shared/UserId";
import type { UserMessageActivity } from "./UserMessageActivity";

export type UserMessageActivityEvent = { chat: Chat, thread_root_message_index?: MessageIndex | undefined, message_index: MessageIndex, message_id: MessageId, event_index: EventIndex, activity: UserMessageActivity, timestamp: bigint, user_id?: UserId | undefined, };
