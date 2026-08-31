use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AcceptSwapSuccess, MessageId, MessageIndex, PinNumberWrapper, UserId, icrc1};

#[ts_export(user, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    // The account token1 is deposited from, defaulting to this canister's own. Any other account
    // must have approved this canister as spender, since the deposit is then pulled via ICRC-2.
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    Error(OCError),
}
