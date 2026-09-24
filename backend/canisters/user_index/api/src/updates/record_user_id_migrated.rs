use serde::{Deserialize, Serialize};
use types::{CanisterId, UnitResult, UserId};

// Only available in test mode, until the UserIndex migrates users itself
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub old_user_id: UserId,
    pub new_user_id: UserId,
    // The groups and communities the user is in
    pub canisters_to_notify: Vec<CanisterId>,
}

pub type Response = UnitResult;
