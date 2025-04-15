use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, EmptySuccessOrError, ProposalUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub proposals: Vec<ProposalUpdate>,
}

pub type Response = EmptySuccessOrError;
