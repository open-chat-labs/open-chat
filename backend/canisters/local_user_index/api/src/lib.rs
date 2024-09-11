use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::nns::CryptoAmount;
use types::{
    CanisterId, ChannelLatestMessageIndex, ChatId, ChitEarnedReason, CommunityId, Cryptocurrency,
    DiamondMembershipPlanDuration, MessageContent, MessageContentInitial, MessageId, MessageIndex, PhoneNumber, ReferralType,
    SuspensionDuration, TimestampMillis, UniquePersonProof, UpdateUserPrincipalArgs, User, UserId, UserType,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UsernameChanged(UsernameChanged),
    DisplayNameChanged(DisplayNameChanged),
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
    UserRegistered(UserRegistered),
    SuperAdminStatusChanged(PlatformModeratorStatusChanged),
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
pub struct PlatformModeratorStatusChanged {
    pub user_id: UserId,
    pub is_super_admin: bool,
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
    pub token: Cryptocurrency,
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

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GlobalUser {
    pub user_id: UserId,
    pub principal: Principal,
    #[serde(default)]
    pub is_bot: bool,
    #[serde(default)]
    pub is_platform_moderator: bool,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub unique_person_proof: Option<UniquePersonProof>,
    #[serde(default)]
    pub user_type: UserType,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChitEarned {
    pub user_id: UserId,
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementAwarded {
    #[serde(default)]
    pub id: u32,
    pub user_id: UserId,
    pub name: String,
    pub chit_reward: u32,
}
