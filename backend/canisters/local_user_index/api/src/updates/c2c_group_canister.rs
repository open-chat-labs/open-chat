use crate::GroupEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<GroupEvent>>,
}

pub type Response = SuccessOnly;
