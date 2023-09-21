use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CompletedCryptoTransaction, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub transfer: CompletedCryptoTransaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CannotTipSelf,
    NotAuthorized,
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserSuspended,
}
