// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { MessageIndex } from "../shared/MessageIndex";

export type UserChannelSummaryUpdates = { channel_id: bigint, read_by_me_up_to?: MessageIndex | undefined, 
/**
 * @default {}
 */
threads_read: Record<MessageIndex, MessageIndex>, archived?: boolean | undefined, date_read_pinned?: bigint | undefined, };
