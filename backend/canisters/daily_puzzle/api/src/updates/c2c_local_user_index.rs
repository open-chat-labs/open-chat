use crate::LocalUserIndexEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<LocalUserIndexEvent>>,
}

pub type Response = UnitResult;
