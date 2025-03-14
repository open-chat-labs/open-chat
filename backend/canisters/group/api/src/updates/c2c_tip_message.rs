#![allow(deprecated)]
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, MessageId, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token: Option<types::Cryptocurrency>,
    pub token_symbol: Option<String>,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CannotTipSelf,
    RecipientMismatch,
    NotAuthorized,
    GroupFrozen,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    Error(OCError),
}
