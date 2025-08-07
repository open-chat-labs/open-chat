use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserIndexEvent>,
}

pub type Response = SuccessOnly;
