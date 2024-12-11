use crate::UserEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
