use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, UnitResult, UserId};

#[ts_export(user, cancel_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

pub type Response = UnitResult;
