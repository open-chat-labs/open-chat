use crate::UserIndexToLocalUserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserIndexToLocalUserIndexEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
