// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChannelId } from "../../shared/ChannelId";
import type { MessageId } from "../../shared/MessageId";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { PinNumberWrapper } from "../../shared/PinNumberWrapper";

export type CommunityAcceptP2pSwapArgs = { channel_id: ChannelId, thread_root_message_index?: MessageIndex, message_id: MessageId, pin?: PinNumberWrapper, new_achievement: boolean, };
