use serde::{Deserialize, Serialize};
use types::{Achievement, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub achievements: Vec<Achievement>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotFound,
}
