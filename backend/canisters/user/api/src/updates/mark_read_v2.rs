use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<crate::mark_read::ChatMessagesRead>,
}

pub type Response = crate::mark_read::Response;
