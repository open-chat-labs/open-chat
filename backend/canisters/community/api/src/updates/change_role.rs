use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;
use types::{CommunityRole, UserId};

#[ts_export(community, change_role)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub user_ids: Vec<UserId>,
    pub new_role: CommunityRole,
}

#[ts_export(community, change_role)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(HashMap<UserId, OCError>),
    Error(OCError),
}
