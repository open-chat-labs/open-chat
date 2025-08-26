use candid::Deserialize;
use serde::Serialize;
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

pub type Response = UnitResult;
