use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_openai_api_key)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub api_key: String,
}

pub type Response = UnitResult;
