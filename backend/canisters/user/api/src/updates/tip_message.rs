#![allow(deprecated)]
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Chat, Cryptocurrency, MessageId, MessageIndex, Milliseconds, PinNumberWrapper, UserId};

#[ts_export(user, tip_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
#[serde(from = "ArgsCombined")]
pub struct Args {
    pub chat: Chat,
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub token: Cryptocurrency,
    pub amount: u128,
    pub fee: u128,
    pub decimals: u8,
    pub pin: Option<PinNumberWrapper>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ArgsCombined {
    chat: Chat,
    recipient: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    ledger: CanisterId,
    token_symbol: Option<String>,
    token: Option<Cryptocurrency>,
    amount: u128,
    fee: u128,
    decimals: u8,
    pin: Option<PinNumberWrapper>,
}

impl From<ArgsCombined> for Args {
    fn from(value: ArgsCombined) -> Self {
        let token_symbol = value
            .token_symbol
            .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

        Args {
            chat: value.chat,
            recipient: value.recipient,
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            ledger: value.ledger,
            token_symbol: token_symbol.clone(),
            token: token_symbol.into(),
            amount: value.amount,
            fee: value.fee,
            decimals: value.decimals,
            pin: value.pin,
        }
    }
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
}
