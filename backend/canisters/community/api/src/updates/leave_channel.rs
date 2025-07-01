use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult};

#[ts_export(community, leave_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

pub type Response = UnitResult;
