use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, MessageId, MessageIndex, MultiUserChat};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: MultiUserChat,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
}
