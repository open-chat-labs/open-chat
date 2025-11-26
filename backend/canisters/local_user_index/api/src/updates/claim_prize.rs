use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, MessageId, MultiUserChat, SignedDelegation};

#[ts_export(local_user_index, claim_prize)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: MultiUserChat,
    pub message_id: MessageId,
    pub delegation: Option<SignedDelegation>,
}

#[ts_export(local_user_index, claim_prize)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferFailed(String, FailedCryptoTransaction),
    FailedAfterTransfer(String, CompletedCryptoTransaction),
    Error(OCError),
}
