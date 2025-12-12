use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub pattern: String,
    pub add: bool,
}

pub type Response = UnitResult;
