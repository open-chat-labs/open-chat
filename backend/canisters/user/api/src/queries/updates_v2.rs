use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DirectChatSummary, DirectChatSummaryUpdates, OptionUpdate, TimestampMillis, UserId, Version};

pub type Args = crate::updates::Args;

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats_added: Vec<DirectChatSummary>,
    pub direct_chats_updated: Vec<DirectChatSummaryUpdates>,
    pub group_chats_added: Vec<crate::GroupChatSummary>,
    pub group_chats_updated: Vec<crate::GroupChatSummaryUpdates>,
    pub chats_removed: Vec<ChatId>,
    pub avatar_id: OptionUpdate<u128>,
    pub user_canister_wasm_version: Option<Version>,
    pub blocked_users_v2: Option<Vec<UserId>>,
    pub pinned_chats: Option<Vec<ChatId>>,
}

impl From<crate::updates::Response> for Response {
    fn from(value: crate::updates::Response) -> Self {
        match value {
            crate::updates::Response::Success(s) => Response::Success(s.into()),
            crate::updates::Response::SuccessNoUpdates => Response::SuccessNoUpdates,
        }
    }
}

impl From<crate::updates::SuccessResult> for SuccessResult {
    fn from(value: crate::updates::SuccessResult) -> Self {
        SuccessResult {
            timestamp: value.timestamp,
            direct_chats_added: value.direct_chats_added,
            direct_chats_updated: value.direct_chats_updated,
            group_chats_added: value.group_chats_added,
            group_chats_updated: value.group_chats_updated,
            chats_removed: value.chats_removed,
            avatar_id: value.avatar_id,
            user_canister_wasm_version: None,
            blocked_users_v2: value.blocked_users,
            pinned_chats: value.pinned_chats,
        }
    }
}
