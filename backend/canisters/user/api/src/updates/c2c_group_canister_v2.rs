use crate::GroupCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

// Each event is paired with the user it is for, so that a single call can carry the events for
// every user a canister holds
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<(UserId, GroupCanisterEvent)>>,
}

pub type Response = SuccessOnly;
