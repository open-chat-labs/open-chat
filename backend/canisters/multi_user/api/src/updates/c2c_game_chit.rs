use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    // e.g. "light_up"
    pub game_id: String,
    // Idempotency key, unique per game_id. e.g. "142:solve", "142:hint:2"
    pub key: String,
    // > 0 credit, < 0 debit, never 0
    pub amount: i32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chit_balance: i32,
    pub total_chit_earned: i32,
}
