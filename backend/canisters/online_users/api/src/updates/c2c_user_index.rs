use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserIndexEvent>>,
}

pub type Response = SuccessOnly;
