use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

// Each event names the user it is from and the user it is for, so that a single call can carry the
// events between any of the users held by the calling canister and any of those held by the
// receiving canister
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<Event>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Event {
    #[serde(rename = "s")]
    pub sender: UserId,
    #[serde(rename = "r")]
    pub recipient: UserId,
    #[serde(rename = "e")]
    pub event: UserCanisterEvent,
}

pub type Response = SuccessOnly;
