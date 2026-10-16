use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub api_key: Option<String>,
}

pub type Response = SuccessOnly;
