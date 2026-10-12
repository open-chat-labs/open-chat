use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user, set_bio)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub text: String,
}

pub type Response = UnitResult;
