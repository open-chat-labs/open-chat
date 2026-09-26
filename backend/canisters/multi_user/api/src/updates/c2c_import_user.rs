use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{Hash, UserId};

// Called by the LocalUserIndex to import a user whose canister has started migrating them to this
// canister. The user is assigned their new id straight away, then pulled from their canister in the
// background, after which the LocalUserIndex is told whether they were imported. Calling it again
// for the same migration returns the same id, whereas a call for a later migration of the same user
// abandons the earlier import.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    // The hash of the user as serialized when their migration started, which identifies it
    pub user_hash: Hash,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    Error(OCError),
}
