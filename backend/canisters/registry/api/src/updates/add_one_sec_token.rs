use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(registry, add_one_sec_token)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub token: String,
    pub info_url: String,
}

pub type Response = UnitResult;
