use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChannelId, EventIndex, GroupMember, GroupRole, MessageIndex, TimestampMillis, UserId, VersionedRules, WebhookDetails,
};

#[ts_export(community, selected_channel_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[ts_export(community, selected_channel_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, selected_channel_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<GroupMember>,
    pub basic_members: Vec<UserId>,
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<WebhookDetails>>", optional)]
    pub webhooks: Vec<WebhookDetails>,
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
