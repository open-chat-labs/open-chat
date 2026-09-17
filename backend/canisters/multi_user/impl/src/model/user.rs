use crate::model::user_direct_chats::UserDirectChats;
use candid::Principal;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Timestamped, UserId};

// The state of a single user within the canister. This mirrors the per-user fields of the User
// canister's `Data`, using the same names and types, so that the logic of each endpoint can be
// shared and a user could later be moved between the two kinds of canister.
//
// Any stable memory map entries a user holds are keyed under that user's index, so a `User` must
// only be accessed within its key scope, which `Users` takes care of.
#[derive(Serialize, Deserialize)]
pub struct User {
    pub principal: Principal,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub referred_by: Option<UserId>,
    pub direct_chats: UserDirectChats,
}

impl User {
    pub fn new(principal: Principal, username: String, referred_by: Option<UserId>, now: TimestampMillis) -> User {
        User {
            principal,
            username: Timestamped::new(username, now),
            display_name: Timestamped::default(),
            bio: Timestamped::new(String::new(), now),
            user_created: now,
            suspended: Timestamped::default(),
            referred_by,
            direct_chats: UserDirectChats::default(),
        }
    }

    pub fn verify_not_suspended(&self) -> Result<(), OCErrorCode> {
        if self.suspended.value { Err(OCErrorCode::InitiatorSuspended) } else { Ok(()) }
    }
}
