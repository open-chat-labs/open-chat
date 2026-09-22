use serde::{Deserialize, Serialize};
use types::{CanisterId, ChannelId, MessageId, MessageIndex, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
    // Set by a MultiUser canister to say which of its users is tipping, since the caller alone
    // doesn't identify them. A User canister leaves it unset.
    #[serde(default)]
    pub sender: Option<UserId>,
}

pub type Response = UnitResult;
