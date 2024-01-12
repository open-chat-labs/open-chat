use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64), // The transaction index
    ChatNotFound,
    InsufficientFunds,
    AlreadyAccepted,
    AlreadyCompleted,
    OfferExpired,
    OfferCancelled,
    OfferNotFound,
    UserSuspended,
    InternalError(String),
}
