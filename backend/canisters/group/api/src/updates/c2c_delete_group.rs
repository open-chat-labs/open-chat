use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Args {
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = UnitResult;
