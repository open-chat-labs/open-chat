use crate::UserEvent;
use serde::{Deserialize, Serialize};
use types::{DirectChatUserNotificationPayload, IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserEvent<DirectChatUserNotificationPayload>>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ArgsInternal {
    pub events: Vec<IdempotentEnvelope<UserEvent>>,
}

pub type Response = SuccessOnly;
