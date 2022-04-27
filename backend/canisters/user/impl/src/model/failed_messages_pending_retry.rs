use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;
use user_canister::c2c_send_message;

#[derive(Serialize, Deserialize, Default)]
pub struct FailedMessagesPendingRetry {
    messages: HashMap<UserId, Vec<c2c_send_message::Args>>,
}

impl FailedMessagesPendingRetry {
    pub fn add(&mut self, recipient: UserId, args: c2c_send_message::Args) {
        self.messages.entry(recipient).or_default().push(args);
    }

    pub fn take(&mut self, recipient: &UserId) -> Vec<c2c_send_message::Args> {
        self.messages.remove(recipient).unwrap_or_default()
    }
}
