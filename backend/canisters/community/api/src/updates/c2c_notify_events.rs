use crate::LocalGroupIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<LocalGroupIndexEvent>,
}

pub type Response = crate::c2c_local_group_index::Response;
