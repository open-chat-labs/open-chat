use crate::{MessageActivitySummary, Referral, WalletConfig};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    Chat, ChatId, ChitEarned, CommunityId, DirectChatSummary, DirectChatSummaryUpdates, OptionUpdate, PinNumberSettings,
    StreakInsurance, TimestampMillis, UserId,
};

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub username: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub display_name: OptionUpdate<String>,
    pub direct_chats: DirectChatsUpdates,
    pub group_chats: GroupChatsUpdates,
    pub favourite_chats: FavouriteChatsUpdates,
    pub communities: CommunitiesUpdates,
    #[ts(as = "types::OptionUpdateU128")]
    pub avatar_id: OptionUpdate<u128>,
    pub blocked_users: Option<Vec<UserId>>,
    pub suspended: Option<bool>,
    #[ts(as = "types::OptionUpdatePinNumberSettings")]
    pub pin_number_settings: OptionUpdate<PinNumberSettings>,
    pub achievements: Vec<ChitEarned>,
    pub achievements_last_seen: Option<TimestampMillis>,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
    #[ts(as = "types::OptionUpdateStreakInsurance")]
    pub streak_insurance: OptionUpdate<StreakInsurance>,
    pub next_daily_claim: TimestampMillis,
    pub is_unique_person: Option<bool>,
    pub wallet_config: Option<WalletConfig>,
    pub referrals: Vec<Referral>,
    pub message_activity_summary: Option<MessageActivitySummary>,
}

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatsUpdates {
    pub added: Vec<DirectChatSummary>,
    pub updated: Vec<DirectChatSummaryUpdates>,
    pub removed: Vec<ChatId>,
    pub pinned: Option<Vec<ChatId>>,
}

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatsUpdates {
    pub added: Vec<crate::GroupChatSummary>,
    pub updated: Vec<crate::GroupChatSummaryUpdates>,
    pub removed: Vec<ChatId>,
    pub pinned: Option<Vec<ChatId>>,
}

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitiesUpdates {
    pub added: Vec<crate::CommunitySummary>,
    pub updated: Vec<crate::CommunitySummaryUpdates>,
    pub removed: Vec<CommunityId>,
}

#[ts_export(user, updates)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FavouriteChatsUpdates {
    pub chats: Option<Vec<Chat>>,
    pub pinned: Option<Vec<Chat>>,
}
