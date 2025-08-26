use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, UnitResult};

#[ts_export(group, register_proposal_vote_v2)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub adopt: bool,
}

pub type Response = UnitResult;
