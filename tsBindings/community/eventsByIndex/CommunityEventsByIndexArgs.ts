// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChannelId } from "../../shared/ChannelId";
import type { EventIndex } from "../../shared/EventIndex";
import type { MessageIndex } from "../../shared/MessageIndex";

export type CommunityEventsByIndexArgs = { channel_id: ChannelId, thread_root_message_index?: MessageIndex, events: Array<EventIndex>, latest_known_update?: bigint, };
