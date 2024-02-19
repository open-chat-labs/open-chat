use serde::{Deserialize, Serialize};
use types::{AccessTokenType, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_diamond: bool,
    pub access_type: AccessTokenType,
}

pub type Response = bool;
