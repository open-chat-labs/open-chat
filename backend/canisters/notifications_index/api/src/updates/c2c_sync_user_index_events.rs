use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<UserIndexEvent>,
}

pub type Response = crate::c2c_user_index::Response;
