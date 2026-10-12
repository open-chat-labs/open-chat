use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<IdempotentEnvelope<UserCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}
