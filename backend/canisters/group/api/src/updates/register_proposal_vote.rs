use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, MessageIndex};

#[ts_export(group, register_proposal_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub adopt: bool,
}

pub type Response = EmptySuccessOrError;
