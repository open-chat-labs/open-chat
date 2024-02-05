use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Chat, ChatId, DirectChatSummary, Empty, GroupChatSummary, TimestampMillis, UserId};

pub type Args = Empty;

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
    pub suspended: bool,
    pub local_user_index_canister_id: CanisterId,
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
    pub cached: Option<CachedGroupChatSummaries>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CachedGroupChatSummaries {
    pub summaries: Vec<GroupChatSummary>,
    pub timestamp: TimestampMillis,
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
