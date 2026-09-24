use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user_index, migrated_user_ids)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

// The latest id of each of the given users who has been migrated to a MultiUser canister, keyed
// by the id they were looked up by. Users who have not been migrated are left out.
#[ts_export(user_index, migrated_user_ids)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(HashMap<UserId, UserId>),
}
