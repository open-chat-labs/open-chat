use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub token: String,
    pub info_url: String,
}

pub type Response = UnitResult;
