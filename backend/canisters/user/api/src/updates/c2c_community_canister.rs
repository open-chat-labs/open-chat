use crate::CommunityCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>,
}

pub type Response = SuccessOnly;
