use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessRules, ChannelId, EventIndex, GroupMember, MessageIndex, TimestampMillis, UserId, VersionedRules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PrivateCommunity,
    ChannelNotFound,
    PrivateChannel,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<GroupMember>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    // TODO: remove this field once the website is using `access_rules` instead
    pub rules: AccessRules,
    pub access_rules: VersionedRules,
}
