use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;
use user_canister::c2c_send_message;

#[derive(Serialize, Deserialize, Default)]
pub struct FailedMessagesPendingRetry {
    pub messages: HashMap<UserId, Vec<c2c_send_message::Args>>,
}
