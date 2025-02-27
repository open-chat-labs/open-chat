use crate::LocalUserIndexEvent;
use serde::{Deserialize, Serialize};
use types::IdempotentEnvelope;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<LocalUserIndexEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
