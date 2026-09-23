use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, MessageIndex, PendingCryptoTransaction, UnitResult};

// Tips a message in a channel with a transfer the caller makes from their own funds to the wallet of
// the message's sender. As with `send_message_with_transfer`, the transfer must be ICRC2 or
// Certified, a certified tip carrying the memo `ledger_utils::certified::required_memo` builds from
// OC_TIP and the community's canister id.
#[ts_export(community, tip_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub transfer: PendingCryptoTransaction,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
}

pub type Response = UnitResult;
