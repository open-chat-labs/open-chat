use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{
    BotInstallationLocation, BotPermissions, BuildVersion, CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, Hash,
    MessageContentInitial, MessageId, MessageIndex, Milliseconds, NotifyChit, PremiumItemPurchase, StreakInsuranceClaim,
    StreakInsurancePayment, TimestampMillis, UniquePersonProof, User, UserId,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalUserIndexEvent {
    UserRegistered(Box<UserRegistered>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    UserSetProfileBackground(Box<(UserId, Option<u128>)>),
    NotifyUniquePersonProof(Box<(UserId, UniquePersonProof)>),
    NotifyChit(Box<(UserId, NotifyChit)>),
    NotifyPremiumItemPurchased(Box<(UserId, PremiumItemPurchase)>),
    NotifyStreakInsurancePayment(Box<StreakInsurancePayment>),
    NotifyStreakInsuranceClaim(Box<StreakInsuranceClaim>),
    BotInstalled(Box<BotInstalled>),
    BotUninstalled(Box<BotUninstalled>),
    UserBlocked(UserId, UserId),
    UserUnblocked(UserId, UserId),
    SetMaxStreak(UserId, u16),
    NotifyOfUserDeleted(CanisterId, UserId),
    MediaScanStalled(Box<MediaScanStalled>),
    MediaScanRecovered,
    MultiUserCanisterCreated(CanisterId),
    UserMigrationStarted(Box<UserMigrationStarted>),
    UserMigrationFailedToStart(Box<UserMigrationFailedToStart>),
    UserImported(Box<UserImported>),
    UserImportFailed(Box<UserImportFailed>),
    EventForMigratedUser(Box<EventForMigratedUser>),
    DailyPuzzleDataForMigratedUser(Box<DailyPuzzleDataForMigratedUser>),
}

// An event which a LocalUserIndex had queued for a user's old canister, for a user who has since been
// migrated to a MultiUser canister held by another LocalUserIndex. The UserIndex passes it on to that
// LocalUserIndex, naming the user by their latest id.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EventForMigratedUser {
    pub user_id: UserId,
    // A msgpack serialized `user_canister::LocalUserIndexEvent`, which the UserIndex passes on as it
    // is, so that it needn't be upgraded to pass on events of a new type
    pub event: serde_bytes::ByteBuf,
}

// What a LocalUserIndex's daily puzzle engine held for a user under their old id, their streak among
// it, for a user who has since been migrated to a MultiUser canister held by another LocalUserIndex.
// The UserIndex passes it on to that LocalUserIndex, naming the user by their latest id.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DailyPuzzleDataForMigratedUser {
    pub user_id: UserId,
    // Msgpack serialized by the LocalUserIndex, which the UserIndex passes on as it is
    pub data: serde_bytes::ByteBuf,
}

// The MultiUser canister the user is being migrated to has imported them, giving them a new id
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserImported {
    pub old_user_id: UserId,
    pub new_user_id: UserId,
    // The groups and communities the user is in, each of which is told of the user's new id
    pub canisters_to_notify: Vec<CanisterId>,
    // The users the user has, or had, a direct chat with, each of whom is told of the user's new id
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub users_to_notify: Vec<UserId>,
}

// The MultiUser canister the user is being migrated to couldn't import them
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserImportFailed {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
    // The hash identifying the migration whose import failed
    pub user_hash: Hash,
    pub error: OCError,
}

// The user's canister has started migrating them to the MultiUser canister, and is now frozen
// until the MultiUser canister has pulled them
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserMigrationStarted {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
    // The size of the user serialized with msgpack, which the MultiUser canister pulls
    pub user_bytes: u64,
    // The version of the User canister the user was serialized by
    pub wasm_version: BuildVersion,
    // The hash of the user serialized, which identifies the migration
    pub user_hash: Hash,
}

// The user couldn't be migrated to the MultiUser canister, either because their canister couldn't
// be upgraded to the latest wasm or because it wasn't ready to be migrated
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserMigrationFailedToStart {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
    pub error: OCError,
}

// Raised by a local index when media scan jobs are queued but no verdicts are arriving: the
// off-chain media_hasher worker (or its route to the matching service) needs investigation
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MediaScanStalled {
    pub jobs_pending: u32,
    pub oldest_job_age: Milliseconds,
    pub latest_job_index: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub email: Option<String>,
    pub referred_by: Option<UserId>,
    pub is_from_identity_canister: bool,
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
pub struct JoinUserToGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessageV2 {
    pub user_id: UserId,
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub mentioned: Vec<User>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserDeleted {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementInitial {
    pub id: u32,
    pub name: String,
    pub logo: String,
    pub url: String,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub chit_budget: u32,
    pub submitted_by: UserId,
    pub payment_block_index: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    LocalUserIndex,
    User,
    MultiUser,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotInstalled {
    pub bot_id: UserId,
    pub location: BotInstallationLocation,
    pub installed_by: UserId,
    #[serde(default)]
    pub granted_permissions: BotPermissions,
    #[serde(default)]
    pub granted_autonomous_permissions: BotPermissions,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotUninstalled {
    pub bot_id: UserId,
    pub location: BotInstallationLocation,
    pub uninstalled_by: UserId,
}
