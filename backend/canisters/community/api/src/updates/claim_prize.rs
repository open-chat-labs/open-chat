use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[ts_export(community, claim_prize)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[ts_export(community, claim_prize)]
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
    LedgerError,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    InternalError(String),
    UserLapsed,
    Error(u16, Option<String>),
}
