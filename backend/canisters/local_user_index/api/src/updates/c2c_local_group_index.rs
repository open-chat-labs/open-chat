use crate::LocalGroupIndexEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<LocalGroupIndexEvent>>,
}

pub type Response = UnitResult;
