// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "../../shared/ChatId";
import type { CompletedCryptoTransaction } from "../../shared/CompletedCryptoTransaction";
import type { EventIndex } from "../../shared/EventIndex";
import type { MessageIndex } from "../../shared/MessageIndex";

export type UserSendMessageTransferSuccessV2Result = { chat_id: ChatId, event_index: EventIndex, message_index: MessageIndex, timestamp: bigint, expires_at?: bigint, transfer: CompletedCryptoTransaction, };