use crate::LocalUserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<LocalUserIndexEvent>,
}

pub type Response = crate::c2c_local_user_index::Response;
