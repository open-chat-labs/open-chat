use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{UserId, UserIdAndPrincipal};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    // Each user found, by the id asked for, with their latest id, which differs if they've been
    // migrated to a MultiUser canister, and their principal
    Success(HashMap<UserId, UserIdAndPrincipal>),
}
