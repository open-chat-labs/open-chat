// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CompletedCryptoTransaction } from "../../shared/CompletedCryptoTransaction";
import type { TSNumberWithDefault } from "../../shared/TSNumberWithDefault";

export type UserSendMessageWithTransferToChannelSuccessResult = { event_index: TSNumberWithDefault, message_index: TSNumberWithDefault, timestamp: bigint, expires_at?: bigint | undefined, transfer: CompletedCryptoTransaction, };
