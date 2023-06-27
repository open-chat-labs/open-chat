use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    CommunityFrozen,
    ChannelNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
}
