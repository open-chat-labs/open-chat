use crate::LocalGroupIndexEvent;
use serde::{Deserialize, Serialize};
use types::{Fallback, IdempotentMessage};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentMessage<LocalGroupIndexEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Deserialize)]
pub struct ArgsPrevious {
    pub events: Vec<LocalGroupIndexEvent>,
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
