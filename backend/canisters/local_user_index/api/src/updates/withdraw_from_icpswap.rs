use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::UserId;

#[ts_export(local_user_index, withdraw_from_icpswap)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub swap_id: u128,
    pub input_token: bool,
    pub amount: Option<u128>,
    pub fee: Option<u128>,
}

#[ts_export(local_user_index, withdraw_from_icpswap)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    SwapNotFound,
    AmountNotSpecified,
    InternalError(String),
    Error(u16, Option<String>),
}
