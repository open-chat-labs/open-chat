use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;
use types::{GroupRole, UserId};

#[ts_export(group, change_role)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub user_ids: Vec<UserId>,
    pub new_role: GroupRole,
}

#[ts_export(group, change_role)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(HashMap<UserId, OCError>),
    Error(OCError),
}
