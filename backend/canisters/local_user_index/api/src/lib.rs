use candid::{CandidType, Principal};
use event_store_types::Event;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashMap;
use types::nns::CryptoAmount;
use types::{
    AutonomousConfig, BotCommandDefinition, BotDataEncoding, BotDefinition, BotInstallationLocation, BotSubscriptions,
    BuildVersion, CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, CyclesTopUp, DiamondMembershipPlanDuration,
    MessageContent, MessageContentInitial, MessageId, MessageIndex, Notification, NotifyChit, PhoneNumber, PremiumItemPurchase,
    ReferralType, SuspensionDuration, TimestampMillis, UniquePersonProof, UpdateUserPrincipalArgs, User,
    UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment, UserId, UserType, is_default,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UsernameChanged(UsernameChanged),
    DisplayNameChanged(DisplayNameChanged),
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
    UserRegistered(UserRegistered),
    BotRegistered(BotRegistered),
    BotPublished(BotPublished),
    BotUpdated(BotUpdated),
    BotRemoved(BotRemoved),
    BotUninstall(BotUninstall),
    PlatformOperatorStatusChanged(PlatformOperatorStatusChanged),
    PlatformModeratorStatusChanged(PlatformModeratorStatusChanged),
    MaxConcurrentCanisterUpgradesChanged(MaxConcurrentCanisterUpgradesChanged),
    UserUpgradeConcurrencyChanged(UserUpgradeConcurrencyChanged),
    UserSuspended(UserSuspended),
    UserJoinedGroup(UserJoinedGroup),
    UserJoinedCommunityOrChannel(UserJoinedCommunityOrChannel),
    DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived),
    OpenChatBotMessage(Box<OpenChatBotMessage>),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    ReferralCodeAdded(ReferralCodeAdded),
    UserPrincipalUpdated(UpdateUserPrincipalArgs),
    DeleteUser(DeleteUser),
    SecretKeySet(Vec<u8>),
    NotifyUniquePersonProof(UserId, UniquePersonProof),
    AddCanisterToPool(CanisterId),
    ExternalAchievementAwarded(ExternalAchievementAwarded),
    SyncExistingUser(UserDetailsFull),
    UserBlocked(UserId, UserId),
    UserUnblocked(UserId, UserId),
    UpdateChitBalance(UserId, ChitBalance),
    SetPremiumItemCost(SetPremiumItemCost),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    GroupNameChanged(NameChanged),
    CommunityNameChanged(NameChanged),
    GroupVerifiedChanged(VerifiedChanged),
    CommunityVerifiedChanged(VerifiedChanged),
    NotifyOfUserDeleted(CanisterId, UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupEvent {
    MarkActivity(TimestampMillis),
    MarkActivityForUser(TimestampMillis, UserId),
    EventStoreEvent(Event),
    Notification(Box<Notification>),
}

pub type CommunityEvent = GroupEvent;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NameChanged {
    pub canister_id: CanisterId,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedChanged {
    pub canister_id: CanisterId,
    pub verified: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub user_id: UserId,
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DisplayNameChanged {
    pub user_id: UserId,
    pub display_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub user_id: UserId,
    pub phone_number: PhoneNumber,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub user_id: UserId,
    pub cost: CryptoAmount,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub user_id: UserId,
    pub user_principal: Principal,
    pub username: String,
    pub user_type: UserType,
    pub referred_by: Option<UserId>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotRegistered {
    pub bot_id: UserId,
    pub owner_id: UserId,
    pub user_principal: Principal,
    pub name: String,
    pub commands: Vec<BotCommandDefinition>,
    pub endpoint: String,
    pub autonomous_config: Option<AutonomousConfig>,
    pub permitted_install_location: Option<BotInstallationLocation>,
    pub default_subscriptions: Option<BotSubscriptions>,
    pub data_encoding: BotDataEncoding,
    pub notification_canister: CanisterId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotPublished {
    pub bot_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotUpdated {
    pub bot_id: UserId,
    pub owner_id: UserId,
    pub endpoint: String,
    pub definition: BotDefinition,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotRemoved {
    pub user_id: UserId,
    pub deleted_by: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotUninstall {
    pub location: BotInstallationLocation,
    pub bot_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlatformOperatorStatusChanged {
    pub user_id: UserId,
    pub is_platform_operator: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlatformModeratorStatusChanged {
    pub user_id: UserId,
    pub is_platform_moderator: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MaxConcurrentCanisterUpgradesChanged {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserUpgradeConcurrencyChanged {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserSuspended {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
    pub group_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannel {
    pub user_id: UserId,
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
    pub community_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiamondMembershipPaymentReceived {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub expires_at: TimestampMillis,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount_e8s: u64,
    pub block_index: u64,
    pub duration: DiamondMembershipPlanDuration,
    pub recurring: bool,
    pub send_bot_message: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessage {
    pub user_id: UserId,
    pub message: MessageContent,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessageV2 {
    pub user_id: UserId,
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub mentioned: Vec<User>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReferralCodeAdded {
    pub referral_type: ReferralType,
    pub code: String,
    pub expiry: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteUser {
    pub user_id: UserId,
    pub triggered_by_user: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GlobalUser {
    pub user_id: UserId,
    pub principal: Principal,
    pub is_platform_operator: bool,
    pub is_platform_moderator: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unique_person_proof: Option<UniquePersonProof>,
    pub user_type: UserType,
    #[serde(default)]
    pub chit: ChitBalance,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ChitBalance {
    pub total_earned: i32,
    pub curr_balance: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementAwarded {
    pub id: u32,
    pub user_id: UserId,
    pub name: String,
    pub chit_reward: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserDetailsFull {
    #[serde(rename = "i")]
    pub user_id: UserId,
    #[serde(rename = "p")]
    pub user_principal: Principal,
    #[serde(rename = "n")]
    pub username: String,
    #[serde(rename = "t", default, skip_serializing_if = "is_default")]
    pub user_type: UserType,
    #[serde(rename = "r", skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
    #[serde(rename = "m", default, skip_serializing_if = "is_default")]
    pub is_platform_moderator: bool,
    #[serde(rename = "o", default, skip_serializing_if = "is_default")]
    pub is_platform_operator: bool,
    #[serde(rename = "d", skip_serializing_if = "Option::is_none")]
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(rename = "u", skip_serializing_if = "Option::is_none")]
    pub unique_person_proof: Option<UniquePersonProof>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserEvent {
    NotifyChit(NotifyChit),
    NotifyPremiumItemPurchased(PremiumItemPurchase),
    NotifyStreakInsurancePayment(UserCanisterStreakInsurancePayment),
    NotifyStreakInsuranceClaim(UserCanisterStreakInsuranceClaim),
    UserBlocked(UserId),
    UserUnblocked(UserId),
    UserSetProfileBackground(Option<u128>),
    SetMaxStreak(u16),
    EventStoreEvent(Event),
    Notification(Box<Notification>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    User,
    Group,
    Community,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalGroup {
    pub wasm_version: BuildVersion,
    pub upgrade_in_progress: bool,
    pub latest_activity: TimestampMillis,
    #[serde(default)]
    pub latest_activity_per_user: HashMap<UserId, TimestampMillis>,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalGroup {
    pub fn new(wasm_version: BuildVersion) -> LocalGroup {
        LocalGroup {
            wasm_version,
            upgrade_in_progress: false,
            latest_activity: 0,
            latest_activity_per_user: HashMap::new(),
            cycle_top_ups: Vec::new(),
        }
    }

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<BuildVersion>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }

    pub fn latest_activity(&self, user_id: Option<UserId>) -> TimestampMillis {
        max(
            self.latest_activity,
            user_id
                .and_then(|u| self.latest_activity_per_user.get(&u).copied())
                .unwrap_or_default(),
        )
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalCommunity {
    pub wasm_version: BuildVersion,
    pub upgrade_in_progress: bool,
    pub latest_activity: TimestampMillis,
    #[serde(default)]
    pub latest_activity_per_user: HashMap<UserId, TimestampMillis>,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalCommunity {
    pub fn new(wasm_version: BuildVersion) -> LocalCommunity {
        LocalCommunity {
            wasm_version,
            upgrade_in_progress: false,
            latest_activity: 0,
            latest_activity_per_user: HashMap::new(),
            cycle_top_ups: Vec::new(),
        }
    }

    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<BuildVersion>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }

    pub fn latest_activity(&self, user_id: Option<UserId>) -> TimestampMillis {
        max(
            self.latest_activity,
            user_id
                .and_then(|u| self.latest_activity_per_user.get(&u).copied())
                .unwrap_or_default(),
        )
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetPremiumItemCost {
    pub item_id: u32,
    pub chit_cost: u32,
}
