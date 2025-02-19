use crate::UserId;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    NotFound,
}
