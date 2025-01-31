use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<UserIndexEvent>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
}
