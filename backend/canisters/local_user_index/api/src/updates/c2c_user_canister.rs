use crate::UserEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserEvent>>,
}

pub type Response = SuccessOnly;
