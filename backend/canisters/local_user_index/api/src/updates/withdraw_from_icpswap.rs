use candid::Deserialize;
use serde::Serialize;
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub swap_id: u128,
    pub input_token: bool,
    pub amount: Option<u128>,
    pub fee: Option<u128>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    SwapNotFound,
    SwapCompleted,
    NotAuthorized,
    InternalError(String),
}
