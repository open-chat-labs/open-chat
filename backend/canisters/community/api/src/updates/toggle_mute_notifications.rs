use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult};

#[ts_export(community, toggle_mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub mute: bool,
}

pub type Response = UnitResult;
