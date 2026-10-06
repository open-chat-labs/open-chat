use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub sign_in_proof_jwt: String,
    // The user a MultiUser canister is acting for. A User canister acts for its own user, so leaves
    // this unset
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = UnitResult;
