use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, Reaction, UnitResult, UserId};

#[ts_export(user, add_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
}

pub type Response = UnitResult;
