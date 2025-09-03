use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub removed_by: UserId,
    pub blocked: bool,
    pub group_name: String,
    pub public: bool,
}

pub type Response = SuccessOnly;
