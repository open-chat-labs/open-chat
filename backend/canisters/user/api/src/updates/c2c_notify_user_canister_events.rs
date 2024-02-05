use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserCanisterEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}
