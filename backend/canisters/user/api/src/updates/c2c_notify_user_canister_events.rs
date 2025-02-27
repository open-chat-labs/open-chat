use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserCanisterEvent>,
}

pub type Response = crate::c2c_user_canister::Response;
