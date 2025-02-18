use super::api_key;
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: UserId,
    pub channel_id: Option<ChannelId>,
}

impl From<Args> for api_key::Args {
    fn from(value: Args) -> Self {
        api_key::Args {
            bot_id: value.bot_id,
            channel_id: value.channel_id,
        }
    }
}

pub type Response = types::c2c_bot_api_key::Response;
