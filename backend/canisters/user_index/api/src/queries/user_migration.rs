use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserMigrationStatus),
    NotFound,
}

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
    Failed {
        multi_user_canister_id: CanisterId,
        timestamp: TimestampMillis,
        error: OCError,
    },
}
