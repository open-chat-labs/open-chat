use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

// Queues users in canisters of their own to be migrated to MultiUser canisters. Only available in
// test mode, until the MultiUser canister imports users
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: UsersToMigrate,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum UsersToMigrate {
    // The given number of users who have been offline for the longest
    LongestOffline(u32),
    Specific(Vec<UserId>),
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Users who can't be migrated, or who are already queued, being migrated or have failed to be
    // migrated, are skipped
    pub queued: Vec<UserId>,
}
