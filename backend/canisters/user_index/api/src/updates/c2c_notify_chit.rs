use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub timestamp: TimestampMillis,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
}
