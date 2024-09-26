use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EventIndex, GroupMember, MessageIndex, TimestampMillis, UserId, VersionedRules};

#[ts_export(community, selected_channel_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[ts_export(community, selected_channel_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PrivateCommunity,
    ChannelNotFound,
    PrivateChannel,
}

#[ts_export(community, selected_channel_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<GroupMember>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    pub chat_rules: VersionedRules,
}
