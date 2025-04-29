use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult};

#[ts_export(community, regenerate_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub id: Principal,
}

pub type Response = UnitResult;
