use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    Empty, EventIndex, GroupMember, InstalledBotDetails, MessageIndex, PublicApiKeyDetails, TimestampMillis, UserId,
    VersionedRules,
};

pub type Args = Empty;

#[ts_export(group, selected_initial)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[ts_export(group, selected_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub participants: Vec<GroupMember>,
    pub bots: Vec<InstalledBotDetails>,
    pub api_keys: Vec<PublicApiKeyDetails>,
    pub basic_members: Vec<UserId>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    pub chat_rules: VersionedRules,
}
