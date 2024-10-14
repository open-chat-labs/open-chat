// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "./ChatId";
import type { ChatMetrics } from "./ChatMetrics";
import type { EventIndex } from "./EventIndex";
import type { EventWrapperMessage } from "./EventWrapperMessage";
import type { MessageIndex } from "./MessageIndex";
import type { OptionUpdateU64 } from "./OptionUpdateU64";
import type { OptionUpdateVideoCall } from "./OptionUpdateVideoCall";

export type DirectChatSummaryUpdates = { chat_id: ChatId, last_updated: bigint, latest_message?: EventWrapperMessage | undefined, latest_event_index?: EventIndex | undefined, latest_message_index?: MessageIndex | undefined, read_by_me_up_to?: MessageIndex | undefined, read_by_them_up_to?: MessageIndex | undefined, notifications_muted?: boolean | undefined, updated_events: Array<[EventIndex, bigint]>, metrics?: ChatMetrics | undefined, my_metrics?: ChatMetrics | undefined, archived?: boolean | undefined, events_ttl: OptionUpdateU64, events_ttl_last_updated?: bigint | undefined, video_call_in_progress: OptionUpdateVideoCall, };
