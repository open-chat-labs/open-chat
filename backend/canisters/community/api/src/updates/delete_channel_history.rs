use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, TimestampMillis, UnitResult};

#[ts_export(community, delete_channel_history)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub before: TimestampMillis,
}

pub type Response = UnitResult;
