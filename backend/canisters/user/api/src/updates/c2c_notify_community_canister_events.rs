use crate::CommunityCanisterEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<CommunityCanisterEvent>,
}

pub type Response = crate::c2c_community_canister::Response;
