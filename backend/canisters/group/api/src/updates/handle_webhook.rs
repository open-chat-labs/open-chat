use serde::{Deserialize, Serialize};
use types::UserId;

use super::send_message_v2;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: UserId,
    pub secret: String,
    pub message: String,
}

pub type Response = send_message_v2::Response;
