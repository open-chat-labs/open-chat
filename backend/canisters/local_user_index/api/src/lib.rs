use candid::{CandidType, Principal};
use event_store_types::Event;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashMap;
use types::nns::CryptoAmount;
use types::{
    AutonomousConfig, BlobReference, BotCommandDefinition, BotDataEncoding, BotDefinition, BotDefinitionUpdate,
    BotInstallationLocation, BotSubscriptions, BuildVersion, CanisterId, ChannelId, ChannelLatestMessageIndex,
    ChannelUserNotificationPayload, ChatId, ClassifyMessageRequest, CommunityId, CyclesTopUp, DiamondMembershipPlanDuration,
    GroupChatUserNotificationPayload, MediaScanMatch, MessageContentInitial, MessageId, MessageIndex, Milliseconds,
    Notification, NotifyChit, PhoneNumber, PublicCommunityActivity, PublicGroupActivity, ReferralType, SuspensionDuration,
    TimestampMillis, UniquePersonProof, User, UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment, UserId,
    UserNotificationPayload, UserType, is_default,
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
    BotUninstall(BotInstallationLocation, UserId),
    BotUpdateInstallation(BotInstallationLocation, BotDefinitionUpdate),
    PlatformOperatorStatusChanged(PlatformOperatorStatusChanged),
    PlatformModeratorStatusChanged(PlatformModeratorStatusChanged),
    UserSuspended(UserSuspended),
    UserJoinedGroup(UserJoinedGroup),
    UserJoinedCommunityOrChannel(UserJoinedCommunityOrChannel),
    DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    ReferralCodeAdded(ReferralCodeAdded),
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
    UpdateBlockedUsernamePatterns(UpdateBlockedUsernamePatterns),
    SetOpenAIApiKey(SetOpenAIApiKey),
    SetModerationReferralConfig(SetModerationReferralConfig),
    SetMediaScanConfig(types::MediaScanConfig),
    SetCallPushEnabled(bool),
    SetDailyPuzzleCanisterId(CanisterId),
    UserIdMigrated(UserIdMigrated),
    SetAlchemyApiKey(SetAlchemyApiKey),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    GroupNameChanged(NameChanged),
    CommunityNameChanged(NameChanged),
    GroupVerifiedChanged(VerifiedChanged),
    CommunityVerifiedChanged(VerifiedChanged),
    CommunityModerationFlagsChanged(ModerationFlagsChanged),
    GroupModerationFlagsChanged(ModerationFlagsChanged),
    NotifyOfUserDeleted(CanisterId, UserId),
    DeleteGroup(ChatId),
    DeleteCommunity(CommunityId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(bound = "T: Serialize + DeserializeOwned")]
pub enum GroupOrCommunityEvent<T = UserNotificationPayload> {
    MarkActivity(TimestampMillis),
    MarkActivityForUser(TimestampMillis, UserId),
    EventStoreEvent(Event),
    Notification(Box<Notification<T>>),
    MessageClassifyRequest(Box<ClassifyMessageRequest>),
    MediaScanRequest(Box<types::MediaScanRequest>),
    // Whether the canister has finished replacing the ids users had before being migrated to
    // MultiUser canisters with their latest ids, sent each time that changes
    UserIdMigrationComplete(bool),
    // Relayed to the GroupIndex with the sender's id
    GroupActive(GroupActive),
    CommunityActive(CommunityActive),
    GroupImportComplete(Box<GroupImportComplete>),
    // Relayed to the UserIndex with the sender's id
    CsamDetected(Box<CsamDetected>),
    ModerationReferral(Box<ModerationReferral>),
    // The sender is queued to be upgraded to the latest wasm
    TriggerUpgrade,
}

pub type GroupEvent = GroupOrCommunityEvent<GroupChatUserNotificationPayload>;
pub type CommunityEvent = GroupOrCommunityEvent<ChannelUserNotificationPayload>;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupActive {
    pub duration: Milliseconds,
    pub public_group_activity: Option<PublicGroupActivity>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityActive {
    pub duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupImportComplete {
    pub community_name: String,
    pub channel: ChannelLatestMessageIndex,
    pub group_id: ChatId,
    pub group_name: String,
    pub members: Vec<UserId>,
    pub other_public_channels: Vec<ChannelLatestMessageIndex>,
    pub mark_active_duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CsamDetected {
    // Set by a community canister, identifying the channel within it
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub flags: u32,
    pub content_excerpt: Option<String>,
    // The message's media attachments, so the evidence vault can quarantine them
    pub blob_references: Vec<BlobReference>,
    // Present when the detection was a media hash match rather than the text classifier
    pub media_matches: Vec<MediaScanMatch>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModerationReferral {
    // Set by a community canister, identifying the channel within it
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    // The categories which scored above the referral threshold
    pub flags: u32,
    pub content_excerpt: Option<String>,
    // The message's media attachments, retained on the report in case the human verdict is
    // UpheldAsCsam (which quarantines them)
    pub blob_references: Vec<BlobReference>,
}

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
pub struct ModerationFlagsChanged {
    pub canister_id: CanisterId,
    pub flags: u32,
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

// A user who was migrated to a MultiUser canister, which gave them a new id
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIdMigrated {
    #[serde(rename = "o")]
    pub old_user_id: UserId,
    #[serde(rename = "n")]
    pub new_user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteUser {
    pub user_id: UserId,
    #[serde(default)]
    #[deprecated]
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
    #[serde(default)]
    pub streak: u16,
    #[serde(default)]
    pub streak_ends: TimestampMillis,
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
#[serde(bound = "T: Serialize + DeserializeOwned")]
pub enum UserEvent<T = UserNotificationPayload> {
    NotifyChit(NotifyChit),
    NotifyStreakInsurancePayment(UserCanisterStreakInsurancePayment),
    NotifyStreakInsuranceClaim(UserCanisterStreakInsuranceClaim),
    UserBlocked(UserId),
    UserUnblocked(UserId),
    UserSetProfileBackground(Option<u128>),
    UserSetAvatar(Option<u128>),
    SetMaxStreak(u16),
    EventStoreEvent(Event),
    Notification(Box<Notification<T>>),
    // Whether the MultiUser canister has finished replacing the ids users had before being migrated
    // with their latest ids, sent each time that changes. This is about the canister rather than one
    // of its users, so is sent naming the canister's own id.
    UserIdMigrationComplete(bool),
}

impl<T> UserEvent<T> {
    // Whether the event is about the MultiUser canister itself rather than one of its users
    pub fn is_about_canister(&self) -> bool {
        matches!(self, UserEvent::UserIdMigrationComplete(_))
    }
}

// An event along with the user it is from, as taken by `c2c_user_canister_v2`. A MultiUser canister
// hosts many users, so names whichever of its users the event is from
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(bound = "T: Serialize + DeserializeOwned")]
pub struct UserEventWithUserId<T = UserNotificationPayload> {
    #[serde(rename = "u")]
    pub user_id: UserId,
    #[serde(rename = "e")]
    pub event: UserEvent<T>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    // No longer used, but kept until the User canister wasm has been dropped from the stored wasms
    #[deprecated]
    User,
    Group,
    Community,
    MultiUser,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateBlockedUsernamePatterns {
    pub pattern: String,
    pub add: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetOpenAIApiKey {
    pub api_key: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetAlchemyApiKey {
    pub api_key: Option<String>,
}

// Written by hand so that `#[trace]` doesn't record the key
impl std::fmt::Debug for SetAlchemyApiKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SetAlchemyApiKey")
            .field("api_key_set", &self.api_key.is_some())
            .finish()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetModerationReferralConfig {
    pub config: Option<types::ModerationReferralConfig>,
}
