use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, MessageId, MessageIndex, Reaction};

#[ts_export(group, remove_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub correlation_id: u64,
}

pub type Response = EmptySuccessOrError;
