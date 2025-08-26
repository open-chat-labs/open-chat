use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub suspended: bool,
}

pub type Response = UnitResult;
