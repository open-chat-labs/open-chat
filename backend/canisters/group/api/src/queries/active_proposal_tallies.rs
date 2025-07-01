use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(group, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

pub type Response = types::ActiveTalliesResponse;
