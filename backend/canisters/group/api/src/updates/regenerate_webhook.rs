use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, regenerate_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: UserId,
}

#[ts_export(group, regenerate_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, regenerate_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub secret: String,
}
