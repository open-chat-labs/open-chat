use crate::CommunityCanisterEvent;
use serde::{Deserialize, Serialize};
use types::IdempotentEnvelope;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
