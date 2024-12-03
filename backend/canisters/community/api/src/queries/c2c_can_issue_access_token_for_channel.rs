use serde::{Deserialize, Serialize};
use types::{ChannelId, CheckAccessTokenType, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_diamond: bool,
    pub channel_id: ChannelId,
    pub access_type: CheckAccessTokenType,
}

pub type Response = bool;
