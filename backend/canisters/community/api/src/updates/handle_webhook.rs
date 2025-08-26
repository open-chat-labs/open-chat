use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

use super::send_message;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: UserId,
    pub channel_id: ChannelId,
    pub secret: String,
    pub message: String,
}

pub type Response = send_message::Response;
