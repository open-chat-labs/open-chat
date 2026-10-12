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
    // The ids the sender had before being migrated to a MultiUser canister. The recipient moves what
    // it holds under them, such as its chat with the sender, onto the sender's id before applying the
    // event, in case it hasn't yet been told of the migration. Only taken from a MultiUser canister.
    #[serde(rename = "p", default, skip_serializing_if = "Vec::is_empty")]
    pub sender_previous_user_ids: Vec<UserId>,
}

pub type Response = SuccessOnly;
