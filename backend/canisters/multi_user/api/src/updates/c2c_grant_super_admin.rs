use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

pub type Response = SuccessOnly;
