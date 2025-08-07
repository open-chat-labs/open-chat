use notifications_index_canister::NotificationsIndexEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<NotificationsIndexEvent>>,
}

pub type Response = SuccessOnly;
