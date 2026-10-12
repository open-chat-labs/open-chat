use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // The user being acted for, which must be one of the calling MultiUser canister's users
    pub user_id: UserId,
}

pub type Response = UnitResult;
