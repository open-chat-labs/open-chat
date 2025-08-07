use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(HashMap<UserId, TimestampMillis>),
}
