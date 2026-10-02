use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BuildVersion, CanisterId, TimestampMillis, UserId};

#[ts_export(user_index, user_migration)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(user_index, user_migration)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserMigrationStatus),
    NotFound,
}

#[ts_export(user_index, user_migration)]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum UserMigrationStatus {
    Queued,
    // The user's LocalUserIndex has been asked to start migrating them
    Requested {
        multi_user_canister_id: CanisterId,
        timestamp: TimestampMillis,
    },
    // The user's canister has started migrating them, and is frozen until the MultiUser canister
    // has pulled them
    Started {
        multi_user_canister_id: CanisterId,
        timestamp: TimestampMillis,
        // The size of the user serialized with msgpack, which the MultiUser canister pulls
        user_bytes: u64,
        // The version of the User canister the user was serialized by
        wasm_version: BuildVersion,
    },
    // The MultiUser canister has imported the user, giving them a new id, which they have been
    // switched over to. Their old canister stays frozen.
    Imported {
        multi_user_canister_id: CanisterId,
        timestamp: TimestampMillis,
        new_user_id: UserId,
    },
    Failed {
        multi_user_canister_id: CanisterId,
        timestamp: TimestampMillis,
        error: OCError,
    },
}
