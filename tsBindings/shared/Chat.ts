// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChannelId } from "./ChannelId";
import type { ChatId } from "./ChatId";
import type { CommunityId } from "./CommunityId";

export type Chat = { "Direct": ChatId } | { "Group": ChatId } | { "Channel": [CommunityId, ChannelId] };
