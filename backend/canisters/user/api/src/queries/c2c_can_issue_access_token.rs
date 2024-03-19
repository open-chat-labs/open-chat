use serde::{Deserialize, Serialize};
use types::{AccessTokenType, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_diamond: bool,
    #[serde(default)]
    pub is_bot: bool,
    pub access_type: AccessTokenType,
}

pub type Response = bool;
