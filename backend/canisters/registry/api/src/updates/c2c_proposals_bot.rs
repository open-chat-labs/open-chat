use crate::ProposalsBotEvent;
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<ProposalsBotEvent>>,
}

pub type Response = SuccessOnly;
