use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EventIndex, Tally};

#[ts_export(community, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
}

#[ts_export(community, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub tallies: Vec<(EventIndex, Tally)>,
}
