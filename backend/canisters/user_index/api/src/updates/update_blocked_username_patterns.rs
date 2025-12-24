use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, update_blocked_username_patterns)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub pattern: String,
    pub add: bool,
}

pub type Response = UnitResult;
