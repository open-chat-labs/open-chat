use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(community, create_user_group)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, create_user_group)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, create_user_group)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_group_id: u32,
}
