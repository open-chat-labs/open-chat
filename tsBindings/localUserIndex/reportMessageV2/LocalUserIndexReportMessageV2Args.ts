// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { EventIndex } from "../../shared/EventIndex";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { MultiUserChat } from "../../shared/MultiUserChat";

export type LocalUserIndexReportMessageV2Args = { chat_id: MultiUserChat, thread_root_message_index?: MessageIndex, event_index: EventIndex, reason_code: number, notes?: string, };
