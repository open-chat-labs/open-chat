use serde::{Deserialize, Serialize};
use types::{CheckAccessTokenType, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_diamond: bool,
    pub access_type: CheckAccessTokenType,
}

pub type Response = bool;
