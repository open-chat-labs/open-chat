// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { EventIndex } from "./EventIndex";
import type { UserId } from "./UserId";

export type ThreadSummary = { participant_ids: Array<UserId>, followed_by_me: boolean, reply_count: number, latest_event_index: EventIndex, latest_event_timestamp: bigint, };
