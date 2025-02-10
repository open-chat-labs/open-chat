// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChannelId } from "../../shared/ChannelId";
import type { GroupReplyContext } from "../../shared/GroupReplyContext";
import type { MessageContentInitial } from "../../shared/MessageContentInitial";
import type { MessageId } from "../../shared/MessageId";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { User } from "../../shared/User";
import type { Version } from "../../shared/Version";

export type CommunitySendMessageArgs = { channel_id: ChannelId, thread_root_message_index?: MessageIndex, message_id: MessageId, content: MessageContentInitial, sender_name: string, sender_display_name?: string, replies_to?: GroupReplyContext, mentioned: Array<User>, forwarding: boolean, block_level_markdown: boolean, community_rules_accepted?: Version, channel_rules_accepted?: Version, message_filter_failed?: bigint, new_achievement: boolean, };
