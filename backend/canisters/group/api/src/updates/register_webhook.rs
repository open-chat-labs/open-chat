use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, register_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub avatar: Option<String>,
}

#[ts_export(group, register_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, register_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub id: UserId,
    pub secret: String,
    pub avatar_id: Option<u128>,
}
