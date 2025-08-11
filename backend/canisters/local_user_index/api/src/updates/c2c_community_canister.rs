use crate::CommunityEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<CommunityEvent>>,
}

pub type ArgsInternal = crate::c2c_group_canister::ArgsInternal;
pub type Response = SuccessOnly;
