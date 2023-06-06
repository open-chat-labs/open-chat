use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessRules, EventIndex, GroupMember, MessageIndex, SelectedGroupUpdates, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: EventIndex,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(EventIndex),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub participants_added_or_updated: Vec<GroupMember>,
    pub participants_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub pinned_messages_added: Vec<MessageIndex>,
    pub pinned_messages_removed: Vec<MessageIndex>,
    pub rules: Option<AccessRules>,
}

impl From<SelectedGroupUpdates> for SuccessResult {
    fn from(value: SelectedGroupUpdates) -> Self {
        SuccessResult {
            timestamp: value.timestamp,
            latest_event_index: value.latest_event_index,
            participants_added_or_updated: value.members_added_or_updated,
            participants_removed: value.members_removed,
            blocked_users_added: value.blocked_users_added,
            blocked_users_removed: value.blocked_users_removed,
            invited_users: value.invited_users,
            pinned_messages_added: value.pinned_messages_added,
            pinned_messages_removed: value.pinned_messages_removed,
            rules: value.rules,
        }
    }
}
