use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChannelId;

#[ts_export(community, active_proposal_tallies)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
}

pub type Response = types::ActiveTalliesResponse;
