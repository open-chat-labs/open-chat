use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub enabled: bool,
}

pub type Response = SuccessOnly;
