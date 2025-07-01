use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult, UserId};

#[ts_export(community, delete_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub id: UserId,
}

pub type Response = UnitResult;
