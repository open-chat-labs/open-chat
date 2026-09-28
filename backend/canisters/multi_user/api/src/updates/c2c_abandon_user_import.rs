use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{Hash, UserId};

// Called by the UserIndex before cancelling a user's migration to this canister, to make sure that
// the user can't then be imported. Any import of the user in progress is abandoned, and the
// migration is never imported, even if asked to later. Fails if the user has already been imported,
// in which case the migration must not be cancelled.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    // The hash of the user as serialized when their migration started, which identifies it
    pub user_hash: Hash,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyImported(UserId),
    Error(OCError),
}
