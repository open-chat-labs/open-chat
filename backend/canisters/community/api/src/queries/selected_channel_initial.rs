use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChannelId, EventIndex, GroupMember, GroupRole, MessageIndex, PublicApiKeyDetails, TimestampMillis, UserId, VersionedRules,
};

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
    Error(u16, Option<String>),
}

#[ts_export(community, selected_channel_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<GroupMember>,
    pub basic_members: Vec<UserId>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    pub chat_rules: VersionedRules,
    pub api_keys: Vec<PublicApiKeyDetails>,
}

impl SuccessResult {
    pub fn members(&self) -> Vec<GroupMember> {
        self.members
            .iter()
            .cloned()
            .chain(self.basic_members.iter().map(|u| GroupMember {
                user_id: *u,
                date_added: 0,
                role: GroupRole::Participant,
                lapsed: false,
            }))
            .collect()
    }
}
