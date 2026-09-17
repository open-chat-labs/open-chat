use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // TODO: Make this required once all User canisters are populating it
    pub user_id: Option<UserId>,
    pub events: Vec<IdempotentEnvelope<UserCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}
