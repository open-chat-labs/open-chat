use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Chat, MessageId, MessageIndex, Milliseconds, PinNumberWrapper, UserId};

#[ts_export(user, tip_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: Chat,
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub fee: u128,
    pub decimals: u8,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, tip_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    MessageNotFound,
    CannotTipSelf,
    NotAuthorized,
    TransferCannotBeZero,
    TransferNotToMessageSender,
    TransferFailed(String),
    ChatFrozen,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    UserSuspended,
    UserLapsed,
    Retrying(String),
    InternalError(String),
    Error(OCError),
}
