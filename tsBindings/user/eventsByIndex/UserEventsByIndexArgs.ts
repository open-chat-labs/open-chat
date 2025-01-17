// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { EventIndex } from "../../shared/EventIndex";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { UserId } from "../../shared/UserId";

export type UserEventsByIndexArgs = { user_id: UserId, thread_root_message_index?: MessageIndex | undefined, events: Array<EventIndex>, latest_known_update?: bigint | undefined, };
