use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: UserId,
}

pub type Response = types::c2c_bot_api_key::Response;
