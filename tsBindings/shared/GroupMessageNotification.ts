// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "./ChatId";
import type { CryptoTransferDetails } from "./CryptoTransferDetails";
import type { EventIndex } from "./EventIndex";
import type { MessageIndex } from "./MessageIndex";
import type { UserId } from "./UserId";

export type GroupMessageNotification = { c: ChatId, tr?: MessageIndex, m: MessageIndex, e: EventIndex, g: string, s: UserId, sn: string, sd?: string, ty: string, tx?: string, i?: string, a?: bigint, ct?: CryptoTransferDetails, };
