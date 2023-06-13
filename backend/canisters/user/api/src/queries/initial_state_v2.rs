use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DirectChatSummary, GroupChatSummary, TimestampMillis, UserId, Version};

use crate::map_chats_to_chat_ids;

pub type Args = crate::initial_state::Args;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessCached(SuccessCachedResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: Vec<DirectChatSummary>,
    pub group_chats: Vec<crate::GroupChatSummary>,
    pub avatar_id: Option<u128>,
    pub blocked_users: Vec<UserId>,
    pub pinned_chats: Vec<ChatId>,
    pub user_canister_wasm_version: Version,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessCachedResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: Vec<DirectChatSummary>,
    pub cache_timestamp: TimestampMillis,

    pub cached_group_chat_summaries: Vec<GroupChatSummary>,
    pub group_chats_added: Vec<crate::GroupChatSummary>,

    pub avatar_id: Option<u128>,
    pub blocked_users: Vec<UserId>,
    pub pinned_chats: Vec<ChatId>,
    pub user_canister_wasm_version: Version,
}

impl From<crate::initial_state::Response> for Response {
    fn from(value: crate::initial_state::Response) -> Self {
        let crate::initial_state::Response::Success(s) = value;

        if s.group_chats.cached.is_empty() {
            Response::Success(SuccessResult {
                timestamp: s.timestamp,
                direct_chats: s.direct_chats.summaries,
                group_chats: s.group_chats.summaries,
                avatar_id: s.avatar_id,
                blocked_users: s.blocked_users,
                pinned_chats: map_chats_to_chat_ids(s.favourite_chats.pinned),
                user_canister_wasm_version: Version::default(),
            })
        } else {
            Response::SuccessCached(SuccessCachedResult {
                timestamp: s.timestamp,
                direct_chats: s.direct_chats.summaries,
                cache_timestamp: s.group_chats.cache_timestamp,
                cached_group_chat_summaries: s.group_chats.cached,
                group_chats_added: s.group_chats.summaries,
                avatar_id: s.avatar_id,
                blocked_users: s.blocked_users,
                pinned_chats: map_chats_to_chat_ids(s.favourite_chats.pinned),
                user_canister_wasm_version: Version::default(),
            })
        }
    }
}
