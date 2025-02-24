use crate::GroupCanisterEvent;
use serde::{Deserialize, Serialize};
use types::{Fallback, IdempotentC2CCall};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentC2CCall<GroupCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Deserialize)]
pub struct ArgsPrevious {
    pub events: Vec<GroupCanisterEvent>,
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
