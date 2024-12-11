use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserIndexEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
