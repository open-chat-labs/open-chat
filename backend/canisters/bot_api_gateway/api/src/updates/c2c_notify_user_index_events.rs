use crate::Event;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<Event>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
