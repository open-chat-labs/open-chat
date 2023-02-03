use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    UserSuspended,
    ChatFrozen,
    MessageNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
}
