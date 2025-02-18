use serde::{Deserialize, Serialize};
use types::UserId;

use super::api_key;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: UserId,
}

impl From<Args> for api_key::Args {
    fn from(value: Args) -> Self {
        api_key::Args { bot_id: value.bot_id }
    }
}

pub type Response = types::c2c_bot_api_key::Response;
