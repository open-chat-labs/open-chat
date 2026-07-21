use serde::{Deserialize, Serialize};
use types::{ChannelId, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub text: String,
}

pub type Response = UnitResult;
