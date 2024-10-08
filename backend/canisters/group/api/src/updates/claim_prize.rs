use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, MessageId};

#[ts_export(group, claim_prize)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub correlation_id: u64,
}

#[ts_export(group, claim_prize)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    MessageNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
    LedgerError,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    InternalError(String),
}
