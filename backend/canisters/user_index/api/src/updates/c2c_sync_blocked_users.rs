use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub blocked_users: Vec<(UserId, Vec<UserId>)>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
