use crate::GroupCanisterEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<GroupCanisterEvent>,
}

pub type Response = crate::c2c_group_canister::Response;
