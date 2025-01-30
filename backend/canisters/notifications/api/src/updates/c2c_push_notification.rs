use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};
use types::{CanisterId, UserId};

#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub sender: Option<UserId>,
    pub recipients: Vec<UserId>,
    pub authorizer: Option<CanisterId>,
    pub notification_bytes: ByteBuf,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InternalError(String),
}

impl Debug for Args {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("sender", &self.sender)
            .field("recipients", &self.recipients)
            .field("authorizer", &self.authorizer)
            .field("notification_bytes_length", &self.notification_bytes.len())
            .finish()
    }
}
