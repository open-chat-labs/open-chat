use crate::MultiUserEvent;
use serde::{Deserialize, Serialize};
use types::{DirectChatUserNotificationPayload, IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<MultiUserEvent<DirectChatUserNotificationPayload>>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ArgsInternal {
    pub events: Vec<IdempotentEnvelope<MultiUserEvent>>,
}

pub type Response = SuccessOnly;
