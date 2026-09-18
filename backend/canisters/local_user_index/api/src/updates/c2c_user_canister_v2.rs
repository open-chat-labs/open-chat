use crate::UserEventWithUserId;
use serde::{Deserialize, Serialize};
use types::{DirectChatUserNotificationPayload, IdempotentEnvelope, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserEventWithUserId<DirectChatUserNotificationPayload>>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ArgsInternal {
    pub events: Vec<IdempotentEnvelope<UserEventWithUserId>>,
}

pub type Response = SuccessOnly;
