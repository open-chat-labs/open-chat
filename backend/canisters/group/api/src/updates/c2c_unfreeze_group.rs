use serde::{Deserialize, Serialize};
use types::{EventWrapper, GroupUnfrozen, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<GroupUnfrozen>),
    ChatNotFrozen,
}
