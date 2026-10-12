use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AcceptSwapSuccess, ChannelId, MessageId, MessageIndex, PinNumberWrapper, icrc1};

#[ts_export(community, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    // The account token1 is deposited from, defaulting to the accepting user's wallet. The user's
    // canister pulls the deposit via ICRC-2, spending only an approval made under the user's own
    // spender subaccount (see `ledger_utils::spender_subaccount`).
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
    pub new_achievement: bool,
}

#[ts_export(community, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    Error(OCError),
}
