use crate::GroupIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<GroupIndexEvent>,
}

pub type Response = crate::c2c_group_index::Response;
