use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{Fallback, IdempotentEnvelope};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}

#[derive(Deserialize)]
pub struct ArgsPrevious {
    pub events: Vec<UserCanisterEvent>,
}

impl Fallback for Args {
    type FallbackType = ArgsPrevious;
}

impl From<ArgsPrevious> for Args {
    fn from(value: ArgsPrevious) -> Self {
        Args {
            events: value.events.into_iter().map(|e| e.into()).collect(),
        }
    }
}
