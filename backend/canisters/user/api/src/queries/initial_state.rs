use crate::{MessageActivitySummary, Referral, WalletConfig};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    CanisterId, Chat, ChatId, ChitEarned, DirectChatSummary, Empty, GroupChatSummary, PinNumberSettings, StreakInsurance,
    TimestampMillis, UserId,
};

pub type Args = Empty;

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, initial_state)]
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
    pub pin_number_settings: Option<PinNumberSettings>,
    pub local_user_index_canister_id: CanisterId,
    pub achievements: Vec<ChitEarned>,
    pub achievements_last_seen: TimestampMillis,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
    pub streak_insurance: Option<StreakInsurance>,
    pub next_daily_claim: TimestampMillis,
    pub is_unique_person: bool,
    pub wallet_config: WalletConfig,
    pub referrals: Vec<Referral>,
    pub message_activity_summary: MessageActivitySummary,
}

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct DirectChatsInitial {
    pub summaries: Vec<DirectChatSummary>,
    pub pinned: Vec<ChatId>,
}

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupChatsInitial {
    pub summaries: Vec<crate::GroupChatSummary>,
    pub pinned: Vec<ChatId>,
}

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CachedGroupChatSummaries {
    pub summaries: Vec<GroupChatSummary>,
    pub timestamp: TimestampMillis,
}

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CommunitiesInitial {
    pub summaries: Vec<crate::CommunitySummary>,
}

#[ts_export(user, initial_state)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FavouriteChatsInitial {
    pub chats: Vec<Chat>,
    pub pinned: Vec<Chat>,
}
