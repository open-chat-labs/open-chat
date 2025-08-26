use serde::{Deserialize, Serialize};
use types::{CanisterId, MessageId, MessageIndex, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
}

pub type Response = UnitResult;
