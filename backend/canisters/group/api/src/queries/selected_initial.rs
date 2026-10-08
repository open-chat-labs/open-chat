use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    EventIndex, GroupMember, InstalledBotDetails, MessageIndex, TimestampMillis, UserId, VersionedRules, WebhookDetails,
};

#[ts_export(group, selected_initial)]
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Args {
    // If set, only the first page of members is returned, holding up to this many of them (capped
    // at 1000) in addition to every owner, admin and moderator. The rest can be got from `members`.
    pub max_members: Option<u32>,
}

#[ts_export(group, selected_initial)]
// Allow the large size difference because essentially all responses are the large variant anyway
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, selected_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub participants: Vec<GroupMember>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<InstalledBotDetails>>", optional)]
    pub bots: Vec<InstalledBotDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<WebhookDetails>>", optional)]
    pub webhooks: Vec<WebhookDetails>,
    pub basic_members: Vec<UserId>,
    // Set if there are more members than were returned, to the `after` which `members` should be
    // called with to get the next page of them
    pub more_members_after: Option<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub invited_users: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<MessageIndex>>", optional)]
    pub pinned_messages: Vec<MessageIndex>,
    #[serde(default, skip_serializing_if = "VersionedRules::is_empty")]
    #[ts(as = "Option<VersionedRules>", optional)]
    pub chat_rules: VersionedRules,
}
