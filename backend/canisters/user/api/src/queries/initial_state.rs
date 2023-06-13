use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, ChatId, DirectChatSummary, GroupChatSummary, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub disable_cache: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: DirectChatsInitial,
    pub group_chats: GroupChatsInitial,
    pub favourite_chats: FavouriteChatsInitial,
    pub communities: CommunitiesInitial,
    pub avatar_id: Option<u128>,
    pub blocked_users: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct DirectChatsInitial {
    pub summaries: Vec<DirectChatSummary>,
    pub pinned: Vec<ChatId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupChatsInitial {
    pub summaries: Vec<crate::GroupChatSummary>,
    pub pinned: Vec<ChatId>,
    pub cached: Vec<GroupChatSummary>,
    pub cache_timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CommunitiesInitial {
    pub summaries: Vec<crate::CommunitySummary>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FavouriteChatsInitial {
    pub chats: Vec<Chat>,
    pub pinned: Vec<Chat>,
}
