use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    BlobReference, BotInstallationLocation, BotPermissions, BridgedUser, CanisterId, ChannelLatestMessageIndex, Chat, ChatId,
    CommunityId, FileId, Hash, MediaScanMatch, MessageContentInitial, MessageId, MessageIndex, Milliseconds, NotifyChit,
    PremiumItemPurchase, StreakInsuranceClaim, StreakInsurancePayment, TimestampMillis, UniquePersonProof, User, UserId,
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
    UserSetAvatar(Box<(UserId, Option<u128>)>),
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
    CsamDetected(Box<CsamDetected>),
    ModerationReferral(Box<ModerationReferral>),
    // The profile a bridge bot relayed a message with, for the registry of bridged accounts
    BridgedUserUpdated(Box<BridgedUser>),
}

// A message a chat's classifier or media scan found to be CSAM: the auto-sanction is applied
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CsamDetected {
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub flags: u32,
    pub content_excerpt: Option<String>,
    // The message's media attachments, so the evidence vault can quarantine them
    #[serde(default)]
    pub blob_references: Vec<BlobReference>,
    // Present when the detection was a media hash match rather than the text classifier
    #[serde(default)]
    pub media_matches: Vec<MediaScanMatch>,
}

// A message whose classifier score for a category exceeded the referral threshold: a report is
// created for a human to decide
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModerationReferral {
    pub chat_id: Chat,
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

// The StorageIndex's events
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum StorageIndexEvent {
    // A bucket refused an upload or forward of content whose hash matches content upheld as CSAM
    CsamUploadDetected(CsamUploadMatch),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CsamUploadMatch {
    pub uploader: Principal,
    pub bucket: CanisterId,
    pub file_id: FileId,
    pub hash: Hash,
    // The report whose UpheldAsCsam verdict denylisted the hash
    pub csam_report_index: u64,
    #[serde(default)]
    pub kind: CsamMatchKind,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default)]
pub enum CsamMatchKind {
    // A refused attempt to upload or forward the content AFTER the verdict: a knowing act
    // warranting the same sanction as the original sender
    UploadAttempt,
    ForwardAttempt,
    // Inert default kept for decode compatibility with events sent before the kind field
    // existed. Verdicts are never applied retrospectively to existing copies - every
    // reported copy gets its own human verdict - so this kind triggers no action.
    #[default]
    ExistingCopy,
    // A refused attempt to re-post content while it sits vault-pinned awaiting a verdict.
    // The same hash-match signal which provisionally sanctioned the original sender, so the
    // attempt receives the same provisional treatment, tied to the pending report.
    // APPENDED after ExistingCopy: rmp-serde encodes unit variants by index, so inserting
    // mid-enum re-numbers later variants on the wire - new variants go at the END, always,
    // so an old receiver fails to decode (and the fire-and-forget drops) rather than
    // silently misreading a real variant as a different one.
    PendingQuarantineAttempt,
}

// The Translations canister's events
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum TranslationsEvent {
    SendOpenChatBotMessage(OpenChatBotMessage),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessage {
    pub recipient: UserId,
    pub text: String,
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
    // No longer used, but kept until the User canister wasm has been dropped from the stored wasms
    #[deprecated]
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
