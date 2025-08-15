use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult};

#[ts_export(community, toggle_mute_notifications)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub mute: Option<bool>,
    pub mute_at_everyone: Option<bool>,
}

pub type Response = UnitResult;
