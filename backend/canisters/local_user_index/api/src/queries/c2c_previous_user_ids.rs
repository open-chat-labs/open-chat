use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

// The ids the user had before being migrated to a MultiUser canister, oldest first, or none if they
// weren't migrated
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<UserId>),
}
