use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ActiveProposalTalliesResponse, MultiUserChat};

#[ts_export(local_user_index, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<MultiUserChat>,
}

#[ts_export(local_user_index, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(local_user_index, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub responses: Vec<ActiveProposalTalliesResponse>,
}
