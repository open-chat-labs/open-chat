use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, UserId};

// Queues users in canisters of their own to be migrated to MultiUser canisters
#[ts_export(user_index, migrate_users)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: UsersToMigrate,
    // The canister to migrate the users to, rather than the MultiUser canister with the fewest
    // users. Only for tests, eg. to migrate users to the UserIndex so that it can pull their exports
    #[serde(default)]
    #[ts(as = "Option::<ts_export::TSPrincipal>")]
    pub multi_user_canister_id: Option<CanisterId>,
}

#[ts_export(user_index, migrate_users)]
#[derive(Serialize, Deserialize, Debug)]
pub enum UsersToMigrate {
    // The given number of users who have been offline for the longest
    LongestOffline(u32),
    Specific(Vec<UserId>),
}

#[ts_export(user_index, migrate_users)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, migrate_users)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Users who can't be migrated, or who are already queued, being migrated or have failed to be
    // migrated, are skipped
    pub queued: Vec<UserId>,
}
