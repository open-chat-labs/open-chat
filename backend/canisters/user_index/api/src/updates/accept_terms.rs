use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, accept_terms)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub version: u32,
}

pub type Response = UnitResult;
