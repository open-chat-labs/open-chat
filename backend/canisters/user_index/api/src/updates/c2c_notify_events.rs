use crate::LocalUserIndexToUserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<LocalUserIndexToUserIndexEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
