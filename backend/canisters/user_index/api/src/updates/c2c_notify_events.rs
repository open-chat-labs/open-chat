use serde::{Deserialize, Serialize};
use types::UserJoinedGroup;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<Event>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UserJoinedGroup(UserJoinedGroup),
}
