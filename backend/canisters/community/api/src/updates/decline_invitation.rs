use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult};

#[ts_export(community, decline_invitation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
}

pub type Response = UnitResult;
