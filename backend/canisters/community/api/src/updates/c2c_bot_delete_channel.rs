use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
}

pub type Response = UnitResult;
