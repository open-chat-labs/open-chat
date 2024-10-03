use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChannelId, CommunityId, CompletedCryptoTransaction, Cryptocurrency, EventIndex, GroupReplyContext, MessageContentInitial,
    MessageId, MessageIndex, Milliseconds, TimestampMillis, User, Version,
};

#[ts_export(user, send_message_with_transfer_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub block_level_markdown: bool,
    pub community_rules_accepted: Option<Version>,
    pub channel_rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    pub pin: Option<String>,
}

#[ts_export(user, send_message_with_transfer_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TextTooLong(u32),
    RecipientBlocked,
    UserNotInCommunity(Option<CompletedCryptoTransaction>),
    UserNotInChannel(CompletedCryptoTransaction),
    ChannelNotFound(CompletedCryptoTransaction),
    CryptocurrencyNotSupported(Cryptocurrency),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferCannotBeToSelf,
    P2PSwapSetUpFailed(String),
    UserSuspended,
    UserLapsed,
    CommunityFrozen,
    RulesNotAccepted,
    CommunityRulesNotAccepted,
    Retrying(String, CompletedCryptoTransaction),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}

#[ts_export(user, send_message_with_transfer_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}
