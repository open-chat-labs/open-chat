// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { EventIndex } from "../../shared/EventIndex";
import type { MessageIndex } from "../../shared/MessageIndex";

export type CommunityEventsByIndexArgs = { channel_id: bigint, thread_root_message_index?: MessageIndex | undefined, 
/**
 * @default []
 */
events: Array<EventIndex>, latest_known_update?: bigint | undefined, };
