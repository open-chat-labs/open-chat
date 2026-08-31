use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Chat, MessageId, MessageIndex, PinNumberWrapper, UserId, icrc1};

#[ts_export(user, tip_message)]
#[derive(Serialize, Deserialize, Debug)]
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
    // The account to take the tip from, defaulting to this canister's own. Any other account must
    // have approved this canister as spender, since the tip is then pulled via ICRC-2.
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, tip_message)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Retrying(String),
    Error(OCError),
}
