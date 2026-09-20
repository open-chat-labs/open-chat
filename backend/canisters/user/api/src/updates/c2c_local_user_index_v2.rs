use crate::LocalUserIndexEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<LocalUserIndexEventForUser>>,
}

pub type Response = SuccessOnly;

// Each event names the user it is for, since a MultiUser canister holds many users and the
// LocalUserIndex groups the events it sends by canister. A User canister holds a single user, so
// the events it is sent are all for that user.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalUserIndexEventForUser {
    pub user_id: UserId,
    pub event: LocalUserIndexEvent,
}
