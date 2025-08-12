use crate::{GroupEvent, GroupOrCommunityEvent};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<GroupEvent>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArgsInternal {
    pub events: Vec<IdempotentEnvelope<GroupOrCommunityEvent>>,
}

pub type Response = SuccessOnly;
