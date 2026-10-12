use crate::{MessageActivitySummary, Referral, WalletConfig};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    Chat, ChatId, ChitEvent, CommunityId, DirectChatSummary, DirectChatSummaryUpdates, InstalledBotDetails, OptionUpdate,
    PinNumberSettings, StreakInsurance, TimestampMillis, UserId,
};

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[expect(clippy::large_enum_variant)]
#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<types::OptionUpdateString>", optional)]
    pub display_name: OptionUpdate<String>,
    #[serde(default, skip_serializing_if = "DirectChatsUpdates::is_empty")]
    #[ts(as = "Option<DirectChatsUpdates>", optional)]
    pub direct_chats: DirectChatsUpdates,
    #[serde(default, skip_serializing_if = "GroupChatsUpdates::is_empty")]
    #[ts(as = "Option<GroupChatsUpdates>", optional)]
    pub group_chats: GroupChatsUpdates,
    #[serde(default, skip_serializing_if = "FavouriteChatsUpdates::is_empty")]
    #[ts(as = "Option<FavouriteChatsUpdates>", optional)]
    pub favourite_chats: FavouriteChatsUpdates,
    #[serde(default, skip_serializing_if = "CommunitiesUpdates::is_empty")]
    #[ts(as = "Option<CommunitiesUpdates>", optional)]
    pub communities: CommunitiesUpdates,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<types::OptionUpdateU128>", optional)]
    pub avatar_id: OptionUpdate<u128>,
    pub blocked_users: Option<Vec<UserId>>,
    pub suspended: Option<bool>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<types::OptionUpdatePinNumberSettings>", optional)]
    pub pin_number_settings: OptionUpdate<PinNumberSettings>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<ChitEvent>>", optional)]
    pub achievements: Vec<ChitEvent>,
    pub achievements_last_seen: Option<TimestampMillis>,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
    pub max_streak: u16,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<types::OptionUpdateStreakInsurance>", optional)]
    pub streak_insurance: OptionUpdate<StreakInsurance>,
    pub next_daily_claim: TimestampMillis,
    pub is_unique_person: Option<bool>,
    pub wallet_config: Option<WalletConfig>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<Referral>>", optional)]
    pub referrals: Vec<Referral>,
    pub message_activity_summary: Option<MessageActivitySummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<InstalledBotDetails>>", optional)]
    pub bots_added_or_updated: Vec<InstalledBotDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub bots_removed: Vec<UserId>,
    pub btc_address: Option<String>,
    pub one_sec_address: Option<String>,
    pub premium_items: Option<Vec<u32>>,
    pub pinned_chats: Option<Vec<Chat>>,
}

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DirectChatsUpdates {
    pub added: Vec<DirectChatSummary>,
    pub updated: Vec<DirectChatSummaryUpdates>,
    pub removed: Vec<ChatId>,
}

impl DirectChatsUpdates {
    pub fn is_empty(&self) -> bool {
        self.added.is_empty() && self.updated.is_empty() && self.removed.is_empty()
    }
}

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GroupChatsUpdates {
    pub added: Vec<crate::GroupChatSummary>,
    pub updated: Vec<crate::GroupChatSummaryUpdates>,
    pub removed: Vec<ChatId>,
}

impl GroupChatsUpdates {
    pub fn is_empty(&self) -> bool {
        self.added.is_empty() && self.updated.is_empty() && self.removed.is_empty()
    }
}

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CommunitiesUpdates {
    pub added: Vec<crate::CommunitySummary>,
    pub updated: Vec<crate::CommunitySummaryUpdates>,
    pub removed: Vec<CommunityId>,
}

impl CommunitiesUpdates {
    pub fn is_empty(&self) -> bool {
        self.added.is_empty() && self.updated.is_empty() && self.removed.is_empty()
    }
}

#[ts_export(user, updates)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct FavouriteChatsUpdates {
    pub chats: Option<Vec<Chat>>,
    pub pinned: Option<Vec<Chat>>,
}

impl FavouriteChatsUpdates {
    pub fn is_empty(&self) -> bool {
        self.chats.is_none() && self.pinned.is_none()
    }
}
