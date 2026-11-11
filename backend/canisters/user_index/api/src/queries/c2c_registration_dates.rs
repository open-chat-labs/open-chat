use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    // When each user registered, leaving out users the UserIndex doesn't know or has no date for
    Success(Vec<(UserId, TimestampMillis)>),
}
